import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
      <main className="mx-auto max-w-4xl space-y-5 p-4 pb-28 sm:p-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><BellRing className="h-6 w-6 text-primary" /> Уведомления</h1>
          <p className="mt-1 text-sm text-muted-foreground">Плановые Telegram-рассылки для «{org.name}». Изменения применяются со следующего запуска и не отменяют уже отправленные сообщения.</p>
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
              {settings.data.recipients.filter((recipient) => recipient.videoEligible).map((recipient) => (
                <Button key={recipient.id} variant="outline" size="sm" disabled={test.isPending} onClick={() => test.mutate(recipient.id)}>
                  {test.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
                  Отправить: {recipient.fullName}
                </Button>
              ))}
              {!settings.data.recipients.some((recipient) => recipient.videoEligible) && <p className="text-sm text-muted-foreground">Нет сотрудников IT с подключённым Telegram.</p>}
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
  const available = setting.key === "video_report_reminder" ? recipients.filter((item) => item.videoEligible) : recipients;
  const selected = new Set(setting.recipientMemberIds);
  const toggle = (memberId: number) => {
    const ids = selected.has(memberId) ? setting.recipientMemberIds.filter((id) => id !== memberId) : [...setting.recipientMemberIds, memberId];
    onSave({ notificationKey: setting.key, isEnabled: setting.isEnabled, sendTime: setting.sendTime, recipientMemberIds: ids });
  };
  const update = (patch: Partial<Pick<OrganizationNotificationSetting, "isEnabled" | "sendTime" | "recipientMemberIds">>) =>
    onSave({ notificationKey: setting.key, isEnabled: patch.isEnabled ?? setting.isEnabled, sendTime: patch.sendTime ?? setting.sendTime, recipientMemberIds: patch.recipientMemberIds ?? setting.recipientMemberIds });

  return <Card>
    <CardHeader className="pb-3">
      <div className="flex items-start justify-between gap-4"><div><CardTitle className="text-lg">{setting.title}</CardTitle><CardDescription className="mt-1">{setting.key === "video_report_reminder" ? "Напоминает сотрудникам IT загрузить видеоотчёт." : "Отправляет руководителям итоговую сводку по задачам."}</CardDescription></div><Switch checked={setting.isEnabled} disabled={saving} onCheckedChange={(isEnabled) => update({ isEnabled })} aria-label={`Включить ${setting.title}`} /></div>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="flex max-w-xs items-center gap-3"><Label htmlFor={`${setting.key}-time`} className="shrink-0">Время</Label><input id={`${setting.key}-time`} type="time" value={setting.sendTime} disabled={saving} onChange={(event) => update({ sendTime: event.target.value })} className="h-9 rounded-md border border-input bg-background px-2 text-sm" /></div>
      <div><p className="mb-2 flex items-center gap-1.5 text-sm font-medium"><Users className="h-4 w-4" /> Получатели ({setting.recipientMemberIds.length})</p><div className="max-h-52 space-y-1 overflow-y-auto rounded-md border p-2">
        {available.map((recipient) => <label key={recipient.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"><Checkbox checked={selected.has(recipient.id)} disabled={saving} onCheckedChange={() => toggle(recipient.id)} /><span className="min-w-0 flex-1 truncate">{recipient.fullName}</span><span className="shrink-0 text-xs text-muted-foreground">{recipient.roleName || recipient.departmentName || "Участник"}</span></label>)}
        {!available.length && <p className="px-2 py-3 text-sm text-muted-foreground">Нет доступных получателей с подключённым Telegram.</p>}
      </div><p className="mt-2 text-xs text-muted-foreground">Выберите конкретных получателей. При выключенной рассылке расписание и список сохраняются.</p></div>
    </CardContent>
  </Card>;
}
