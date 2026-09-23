import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { BellRing, Loader2, LockKeyhole, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { orgApi, useCurrentOrg, type OrganizationNotificationSetting } from "@/lib/org";

export const Route = createFileRoute("/notification-settings")({
  component: NotificationSettingsPage,
  head: () => ({ meta: [{ title: "Уведомления — Yaya.Цифровой Бот" }] }),
});

function isOwner(role?: string | null) {
  return ["owner", "владелец"].includes(String(role || "").trim().toLowerCase());
}

function canManageNotifications(role?: string | null) {
  return ["owner", "владелец", "director", "директор", "administrator", "администратор", "admin", "админ", "platform_admin"].includes(String(role || "").trim().toLowerCase());
}

function NotificationSettingsPage() {
  const { org, isLoading: orgLoading } = useCurrentOrg();
  const queryClient = useQueryClient();
  const canManage = canManageNotifications(org?.role_code) || canManageNotifications(org?.role_name);
  const settings = useQuery({
    queryKey: ["notification-settings", org?.id],
    queryFn: () => orgApi.notificationSettings(org!.id),
    enabled: Boolean(org && canManage),
  });
  const save = useMutation({
    mutationFn: (body: Parameters<typeof orgApi.updateNotificationSettings>[1]) =>
      orgApi.updateNotificationSettings(org!.id, body),
    onSuccess: () => {
      toast.success("Настройки уведомления сохранены");
      void queryClient.invalidateQueries({ queryKey: ["notification-settings", org?.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const test = useMutation({
    mutationFn: (memberId: number) => orgApi.testVideoReminder(org!.id, memberId),
    onSuccess: (result) => toast.success(result.sentCount ? "Тестовое напоминание отправлено" : "Отправка завершилась без получателей"),
    onError: (error: Error) => toast.error(error.message),
  });

  if (orgLoading) return <AppLayout><div className="p-6 text-sm text-muted-foreground">Загрузка…</div></AppLayout>;
  if (!org || !canManage) {
    return <AppLayout><div className="mx-auto max-w-lg p-6"><Card><CardHeader><CardTitle className="flex items-center gap-2"><LockKeyhole className="h-5 w-5" /> Нет доступа</CardTitle><CardDescription>Настраивать уведомления могут только Owner, директор и администратор организации.</CardDescription></CardHeader></Card></div></AppLayout>;
  }
  if (settings.isPending) return <AppLayout><div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div></AppLayout>;
  if (settings.isError || !settings.data) return <AppLayout><div className="p-6 text-destructive">Не удалось загрузить настройки уведомлений.</div></AppLayout>;

  const owner = isOwner(org.role_code) || isOwner(org.role_name);
  return (
    <AppLayout wide>
      <main className="w-full space-y-5 p-4 pb-28 sm:p-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><BellRing className="h-6 w-6 text-primary" /> Уведомления</h1>
          <p className="mt-1 text-sm text-muted-foreground">Telegram-уведомления для «{org.name}»: расписание, получатели и текст сообщений. Изменения не отменяют уже отправленные сообщения.</p>
        </div>
        {settings.data.notifications.map((notification) => (
          <NotificationCard
            key={notification.key}
            setting={notification}
            recipients={settings.data.recipients}
            saving={save.isPending}
            onSave={(body) => save.mutate(body)}
          />
        ))}
        {owner && (
          <Card className="border-dashed">
            <CardHeader><CardTitle className="text-base">Тестовое напоминание о видеоотчёте</CardTitle><CardDescription>Отправляется только по нажатию Owner, не меняет расписание и не влияет на рабочую рассылку.</CardDescription></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {settings.data.recipients.filter((recipient) => recipient.reminderEligible).map((recipient) => (
                <Button key={recipient.id} variant="outline" size="sm" disabled={test.isPending} onClick={() => test.mutate(recipient.id)}>
                  {test.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
                  Отправить: {recipient.fullName}
                </Button>
              ))}
              {!settings.data.recipients.some((recipient) => recipient.reminderEligible) && <p className="text-sm text-muted-foreground">Нет Owner или сотрудников IT с подключённым Telegram.</p>}
            </CardContent>
          </Card>
        )}
      </main>
    </AppLayout>
  );
}

function NotificationCard({ setting, recipients, saving, onSave }: {
  setting: OrganizationNotificationSetting;
  recipients: Awaited<ReturnType<typeof orgApi.notificationSettings>>["recipients"];
  saving: boolean;
  onSave: (body: Parameters<typeof orgApi.updateNotificationSettings>[1]) => void;
}) {
  const [draft, setDraft] = useState(setting);
  useEffect(() => setDraft(setting), [setting]);
  const available = setting.key === "video_report_reminder" ? recipients.filter((item) => item.reminderEligible) : recipients;
  const selected = new Set(draft.recipientMemberIds);
  const toggle = (memberId: number) => {
    update({ recipientMemberIds: selected.has(memberId) ? draft.recipientMemberIds.filter((id) => id !== memberId) : [...draft.recipientMemberIds, memberId] });
  };
  const update = (patch: Partial<Pick<OrganizationNotificationSetting, "isEnabled" | "sendTime" | "recipientMemberIds" | "includeAuthor" | "messageTemplate">>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    onSave({ notificationKey: setting.key, isEnabled: next.isEnabled, sendTime: next.sendTime, recipientMemberIds: next.recipientMemberIds, includeAuthor: next.includeAuthor, messageTemplate: next.messageTemplate });
  };
  const description = setting.key === "video_report_reminder"
    ? "Напоминает Owner и сотрудникам IT загрузить видеоотчёт."
    : setting.key === "video_report_delivery"
      ? "Отправляет готовый видеоотчёт после ручной или автоматической отправки."
      : "Отправляет руководителям итоговую сводку по задачам.";
  const preview = (draft.messageTemplate || "").replace(/{{name}}/g, "Алексей").replace(/{{employeeName}}/g, "Алексей").replace(/{{reportDate}}/g, "23 сентября 2026");

  return <Card>
    <CardHeader className="pb-3">
      <div className="flex items-start justify-between gap-4"><div><CardTitle className="text-lg">{setting.title}</CardTitle><CardDescription className="mt-1">{description}</CardDescription></div><Switch checked={draft.isEnabled} disabled={saving} onCheckedChange={(isEnabled) => update({ isEnabled })} aria-label={`Включить ${setting.title}`} /></div>
    </CardHeader>
    <CardContent className="space-y-4">
      {setting.scheduled && <div className="flex max-w-xs items-center gap-3"><Label htmlFor={`${setting.key}-time`} className="shrink-0">Время</Label><input id={`${setting.key}-time`} type="time" value={draft.sendTime} disabled={saving} onChange={(event) => update({ sendTime: event.target.value })} className="h-9 rounded-md border border-input bg-background px-2 text-sm" /></div>}
      <div><p className="mb-2 flex items-center gap-1.5 text-sm font-medium"><Users className="h-4 w-4" /> Получатели ({draft.recipientMemberIds.length})</p><div className="max-h-52 space-y-1 overflow-y-auto rounded-md border p-2">
        {available.map((recipient) => <label key={recipient.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"><Checkbox checked={selected.has(recipient.id)} disabled={saving} onCheckedChange={() => toggle(recipient.id)} /><span className="min-w-0 flex-1 truncate">{recipient.fullName}</span><span className="shrink-0 text-xs text-muted-foreground">{recipient.roleName || recipient.departmentName || "Участник"}</span></label>)}
        {!available.length && <p className="px-2 py-3 text-sm text-muted-foreground">Нет доступных получателей с подключённым Telegram.</p>}
      </div><p className="mt-2 text-xs text-muted-foreground">Выберите конкретных получателей. При выключенной рассылке расписание и список сохраняются.</p></div>
      {setting.key === "video_report_delivery" && <label className="flex items-center gap-2 text-sm"><Checkbox checked={draft.includeAuthor} disabled={saving} onCheckedChange={(includeAuthor) => update({ includeAuthor: includeAuthor === true })} /> Отправлять копию автору отчёта</label>}
      {(setting.key === "video_report_reminder" || setting.key === "video_report_delivery") && <div className="space-y-2"><Label htmlFor={`${setting.key}-template`}>Текст сообщения</Label><textarea id={`${setting.key}-template`} value={draft.messageTemplate ?? ""} disabled={saving} onChange={(event) => setDraft((current) => ({ ...current, messageTemplate: event.target.value }))} onBlur={() => update({ messageTemplate: draft.messageTemplate })} className="min-h-24 w-full rounded-md border border-input bg-background p-2 text-sm" placeholder={setting.key === "video_report_reminder" ? "Текст напоминания" : "Заголовок готового отчёта"} /><p className="text-xs text-muted-foreground">{setting.key === "video_report_reminder" ? "Можно использовать {{name}}." : "Можно использовать {{employeeName}} и {{reportDate}}. Ниже автоматически добавятся задачи, ссылка на отчёт и видео."}</p>{preview && <div className="rounded-md bg-muted p-3 text-sm whitespace-pre-wrap"><span className="mb-1 block text-xs font-medium text-muted-foreground">Предпросмотр</span>{preview}</div>}</div>}
    </CardContent>
  </Card>;
}
