import { useEffect, useRef, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Camera, Check, Link2, Loader2, ShieldCheck, UserRound } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, formatDate, type User } from "@/lib/api";
import { useCurrentUser } from "@/lib/use-current-user";
import {
  AVAILABILITY_LABELS,
  SELF_STATUSES,
  orgApi,
  setStoredOrg,
  useCurrentOrg,
  type AvailabilityStatus,
  type MyOrganization,
} from "@/lib/org";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Мой профиль — Yaya.Цифровой Бот" }] }),
  component: ProfilePage,
});

const selectClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50";

function Card({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="rounded-xl bg-primary/10 p-2.5 text-primary">{icon}</span>
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Feedback({ error, success }: { error: Error | null; success: boolean }) {
  if (error)
    return (
      <p role="alert" className="mt-3 text-sm text-destructive">
        {error.message}
      </p>
    );
  return success ? (
    <p role="status" className="mt-3 flex items-center gap-1.5 text-sm text-emerald-600">
      <Check className="h-4 w-4" />
      Изменения сохранены
    </p>
  ) : null;
}

function CameraCaptureDialog({
  open,
  onOpenChange,
  onCapture,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (file: File) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setError(null);
    setReady(false);

    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Камера не поддерживается этим браузером.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (cameraError) {
        const message =
          cameraError instanceof Error ? cameraError.message : "Не удалось открыть камеру.";
        setError(`Не удалось открыть камеру: ${message}`);
      }
    };

    void startCamera();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [open]);

  const takePhoto = () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) {
      setError("Подождите, камера ещё запускается.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setError("Не удалось подготовить снимок.");
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("Не удалось создать снимок.");
          return;
        }
        onCapture(new File([blob], `avatar-${Date.now()}.jpg`, { type: "image/jpeg" }));
        onOpenChange(false);
      },
      "image/jpeg",
      0.9,
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>Сфотографироваться</DialogTitle>
        <div className="overflow-hidden rounded-xl bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onLoadedMetadata={() => setReady(true)}
            className="aspect-square w-full object-cover"
          />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button disabled={!ready || !!error} onClick={takePhoto}>
            <Camera className="h-4 w-4" /> Сделать снимок
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProfilePage() {
  const user = useCurrentUser();
  const { org, orgs, can, isLoading, isError, query } = useCurrentOrg();
  return (
    <AppLayout allowWithoutOrg>
      <div className="mx-auto max-w-5xl space-y-6 pb-8">
        <header>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
            Личный кабинет
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-brand-deep">Мой профиль</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ваш аккаунт и рабочие настройки в одном месте.
          </p>
        </header>
        {user.data && (
          <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
            <div className="h-20 bg-gradient-to-r from-primary/25 via-primary/10 to-background sm:h-24" />
            <div className="relative px-5 pb-6 sm:px-6">
              <h2 className="mt-5 text-xl font-semibold">
                {user.data.full_name ||
                  [user.data.first_name, user.data.last_name].filter(Boolean).join(" ") ||
                  "Пользователь"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {user.data.username ? `@${user.data.username}` : "Telegram username не указан"}
              </p>
              <div className="mt-5 grid gap-4 border-t border-border pt-4 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-muted-foreground">Аккаунт</p>
                  <p className="mt-1">{user.data.is_active ? "Активен" : "Неактивен"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Дата регистрации</p>
                  <p className="mt-1">{formatDate(user.data.created_at)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Организаций</p>
                  <p className="mt-1">{orgs.length}</p>
                </div>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Имя и Telegram username обновляются при входе через Telegram. Рабочее фото можно
                изменить ниже для каждой организации.
              </p>
            </div>
          </section>
        )}
        {(user.isPending || isLoading) && (
          <p role="status" className="text-sm text-muted-foreground">
            Загружаем профиль…
          </p>
        )}
        {isError && (
          <div role="alert" className="rounded-xl border border-destructive/30 p-4">
            <p>Не удалось загрузить организации.</p>
            <Button variant="outline" className="mt-3" onClick={() => void query.refetch()}>
              Повторить
            </Button>
          </div>
        )}
        {!isLoading && !isError && !org && (
          <Card
            title="Рабочий профиль пока не создан"
            description="Когда вас добавят в организацию, здесь появятся настройки Jira, фотографии и статуса."
            icon={<Building2 className="h-5 w-5" />}
          >
            <p className="text-sm text-muted-foreground">
              Обратитесь к администратору вашей организации.
            </p>
          </Card>
        )}
        {org && (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Рабочий профиль</h2>
                <p className="text-sm text-muted-foreground">
                  Настройки применяются только к выбранной организации.
                </p>
              </div>
              <div className="sm:w-64">
                <Label htmlFor="profile-organization" className="sr-only">
                  Организация
                </Label>
                <select
                  id="profile-organization"
                  className={selectClass}
                  value={org.id}
                  onChange={(event) => setStoredOrg(Number(event.target.value))}
                >
                  {orgs.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {user.data && (
              <OrganizationProfile
                key={org.id}
                org={org}
                user={user.data}
                canEditEmployee={can("employee.update")}
                canReadRoles={can("role.read")}
                canEditOrganization={can("organization.update")}
              />
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}

function OrganizationProfile({
  org,
  user,
  canEditEmployee,
  canReadRoles,
  canEditOrganization,
}: {
  org: MyOrganization;
  user: User;
  canEditEmployee: boolean;
  canReadRoles: boolean;
  canEditOrganization: boolean;
}) {
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [jiraDraft, setJiraDraft] = useState<string | null>(null);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const profile = useQuery({
    queryKey: ["my-profile", org.id],
    queryFn: () => api.myProfile(org.id),
  });
  const departments = useQuery({
    queryKey: ["departments", org.id],
    queryFn: () => orgApi.departments(org.id),
  });
  const status = useQuery({
    queryKey: ["member-status", org.id, org.membership_id],
    queryFn: () => orgApi.getMemberStatus(org.id, org.membership_id),
  });
  const refreshProfile = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["my-profile", org.id] }),
      qc.invalidateQueries({ queryKey: ["org-members", org.id] }),
      qc.invalidateQueries({ queryKey: ["me"] }),
      qc.invalidateQueries({ queryKey: ["users-me"] }),
    ]);
  };
  const jira = useMutation({
    mutationFn: (value: string) => api.updateMyProfile(org.id, value.trim() || null),
    onSuccess: async () => {
      await refreshProfile();
      setJiraDraft(null);
    },
  });
  const avatar = useMutation({
    mutationFn: async (file: File | null) => {
      if (!file) return api.removeMyAvatar(org.id);
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
        throw new Error("Выберите изображение JPEG, PNG или WebP.");
      if (file.size > 5 * 1024 * 1024)
        throw new Error("Размер фотографии не должен превышать 5 МБ.");
      return api.uploadMyAvatar(file, org.id);
    },
    onSuccess: refreshProfile,
  });
  const availability = useMutation({
    mutationFn: (value: AvailabilityStatus) =>
      orgApi.setMemberStatus(org.id, org.membership_id, value),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["member-status", org.id, org.membership_id] }),
        qc.invalidateQueries({ queryKey: ["org-members", org.id] }),
      ]);
    },
  });
  if (profile.isPending)
    return (
      <div role="status" className="flex items-center gap-2 rounded-2xl border p-6">
        <Loader2 className="h-4 w-4 animate-spin" />
        Загружаем настройки организации…
      </div>
    );
  if (profile.isError)
    return (
      <div role="alert" className="rounded-2xl border p-6">
        <p>{profile.error.message}</p>
        <Button variant="outline" className="mt-3" onClick={() => void profile.refetch()}>
          Повторить
        </Button>
      </div>
    );
  const currentJira = profile.data.jira_username ?? "";
  const dirty = (jiraDraft ?? currentJira).trim() !== currentJira;
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <div className="space-y-5">
        <Card
          title="Фото сотрудника"
          description={`Так вас видят коллеги в ${org.name}.`}
          icon={<Camera className="h-5 w-5" />}
        >
          <div className="flex flex-wrap items-center gap-5">
            {profile.data.avatar_url ? (
              <button
                type="button"
                className="rounded-full ring-4 ring-primary/10 transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                onClick={() => setAvatarOpen(true)}
                aria-label="Открыть фото на весь экран"
                title="Открыть фото"
              >
                <UserAvatar
                  avatarUrl={profile.data.avatar_url}
                  name={user.full_name || user.first_name || "Пользователь"}
                  className="h-24 w-24"
                  fallbackClassName="text-3xl"
                />
              </button>
            ) : (
              <UserAvatar
                avatarUrl={null}
                name={user.full_name || user.first_name || "Пользователь"}
                className="h-24 w-24 ring-4 ring-primary/10"
                fallbackClassName="text-3xl"
              />
            )}
            <div className="space-y-2">
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                aria-label="Фото сотрудника"
                disabled={avatar.isPending}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) avatar.mutate(file);
                  event.target.value = "";
                }}
              />
              <Button
                variant="outline"
                disabled={avatar.isPending}
                onClick={() => fileInput.current?.click()}
              >
                {avatar.isPending
                  ? "Сохраняем…"
                  : profile.data.has_custom_avatar
                    ? "Изменить фото"
                    : "Добавить фото"}
              </Button>
              <Button
                variant="outline"
                disabled={avatar.isPending}
                onClick={() => setCameraOpen(true)}
              >
                <Camera className="h-4 w-4" /> Сфотографироваться
              </Button>
              {profile.data.has_custom_avatar && (
                <Button
                  variant="ghost"
                  className="block text-destructive"
                  disabled={avatar.isPending}
                  onClick={() => avatar.mutate(null)}
                >
                  Удалить фото
                </Button>
              )}
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            JPEG, PNG или WebP, до 5 МБ. После удаления используется фото аккаунта.
          </p>
          <Feedback error={avatar.error} success={avatar.isSuccess} />
          <CameraCaptureDialog
            open={cameraOpen}
            onOpenChange={setCameraOpen}
            onCapture={(file) => avatar.mutate(file)}
          />
          {profile.data.avatar_url && (
            <Dialog open={avatarOpen} onOpenChange={setAvatarOpen}>
              <DialogContent className="h-dvh max-w-none border-0 bg-black p-5 sm:rounded-none">
                <DialogTitle className="sr-only">Фото сотрудника</DialogTitle>
                <img
                  src={profile.data.avatar_url}
                  alt={`Фото: ${user.full_name || user.first_name || "сотрудник"}`}
                  className="h-full w-full object-contain"
                />
              </DialogContent>
            </Dialog>
          )}
        </Card>
        <Card
          title="Мой статус"
          description="Сообщите команде, готовы ли вы к новым задачам."
          icon={<UserRound className="h-5 w-5" />}
        >
          {status.isPending ? (
            <p className="text-sm text-muted-foreground">Загружаем статус…</p>
          ) : status.isError ? (
            <>
              <Feedback error={status.error} success={false} />
              <Button variant="ghost" onClick={() => void status.refetch()}>
                Повторить
              </Button>
            </>
          ) : (
            <>
              <p className="mb-3 text-sm">
                Сейчас:{" "}
                <strong>
                  {status.data?.availability_status
                    ? AVAILABILITY_LABELS[status.data.availability_status]
                    : "Не указан"}
                </strong>
              </p>
              <div className="flex flex-wrap gap-2">
                {SELF_STATUSES.map((value) => (
                  <Button
                    key={value}
                    variant={status.data?.availability_status === value ? "default" : "outline"}
                    disabled={availability.isPending}
                    onClick={() => availability.mutate(value)}
                  >
                    {AVAILABILITY_LABELS[value]}
                  </Button>
                ))}
              </div>
            </>
          )}
          <Feedback error={availability.error} success={availability.isSuccess} />
        </Card>
      </div>
      <div className="space-y-5">
        <Card
          title="Аккаунт Jira"
          description="Укажите рабочий логин для связи с задачами Jira."
          icon={<Link2 className="h-5 w-5" />}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (dirty) jira.mutate(jiraDraft ?? currentJira);
            }}
          >
            <Label htmlFor="page-jira">Jira username</Label>
            <Input
              id="page-jira"
              className="mt-2"
              autoComplete="off"
              placeholder="Например, ivan.petrov"
              maxLength={255}
              value={jiraDraft ?? currentJira}
              disabled={jira.isPending}
              onChange={(event) => {
                setJiraDraft(event.target.value);
                jira.reset();
              }}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              {currentJira
                ? `Сохранённый логин: ${currentJira}. Очистите поле, чтобы удалить привязку.`
                : "Jira-логин пока не добавлен."}
            </p>
            <div className="mt-4 flex gap-2">
              <Button type="submit" disabled={!dirty || jira.isPending}>
                {jira.isPending ? "Сохраняем…" : "Сохранить"}
              </Button>
              {dirty && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={jira.isPending}
                  onClick={() => {
                    setJiraDraft(null);
                    jira.reset();
                  }}
                >
                  Отменить
                </Button>
              )}
            </div>
            <Feedback error={jira.error} success={jira.isSuccess} />
          </form>
        </Card>
        <Card
          title="Данные сотрудника"
          description="Ваша роль и отдел в организации."
          icon={<ShieldCheck className="h-5 w-5" />}
        >
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Роль</dt>
              <dd className="mt-1 font-medium">{org.role_name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Отдел</dt>
              <dd className="mt-1 font-medium">
                {org.department_id
                  ? (departments.data?.find((item) => item.id === org.department_id)?.name ??
                    (departments.isError ? "Не удалось загрузить" : "Загрузка…"))
                  : "Не назначен"}
              </dd>
            </div>
          </dl>
          {canEditEmployee ? (
            <EmployeeForm org={org} canReadRoles={canReadRoles} />
          ) : (
            <p className="mt-4 text-xs text-muted-foreground">
              Роль и отдел назначает администратор организации.
            </p>
          )}
        </Card>
        <Card
          title="Организация"
          description="Общие сведения вашей команды."
          icon={<Building2 className="h-5 w-5" />}
        >
          {canEditOrganization ? (
            <OrganizationForm org={org} />
          ) : (
            <>
              <p className="font-medium">{org.name}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                {org.description || "Описание пока не добавлено."}
              </p>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function EmployeeForm({ org, canReadRoles }: { org: MyOrganization; canReadRoles: boolean }) {
  const qc = useQueryClient();
  const [role, setRole] = useState<number | null>(null);
  const [department, setDepartment] = useState<string | null>(null);
  const roles = useQuery({
    queryKey: ["roles", org.id],
    queryFn: () => orgApi.roles(org.id),
    enabled: canReadRoles,
  });
  const departments = useQuery({
    queryKey: ["departments", org.id],
    queryFn: () => orgApi.departments(org.id),
  });
  const mutation = useMutation({
    mutationFn: () =>
      orgApi.updateMember(org.id, org.membership_id, {
        ...(role !== null ? { roleId: role } : {}),
        ...(department !== null ? { departmentId: department ? Number(department) : null } : {}),
      }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["orgs-mine"] }),
        qc.invalidateQueries({ queryKey: ["org-members", org.id] }),
      ]);
      setRole(null);
      setDepartment(null);
    },
  });
  return (
    <form
      className="mt-5 space-y-3 border-t pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
    >
      {canReadRoles && (
        <div>
          <Label htmlFor="employee-role">Роль</Label>
          <select
            id="employee-role"
            className={`${selectClass} mt-2`}
            value={role ?? org.role_id}
            disabled={roles.isPending || roles.isError || mutation.isPending}
            onChange={(event) => {
              setRole(Number(event.target.value));
              mutation.reset();
            }}
          >
            {!roles.data?.some((item) => item.id === org.role_id) && (
              <option value={org.role_id}>{org.role_name}</option>
            )}
            {roles.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <Label htmlFor="employee-department">Отдел</Label>
        <select
          id="employee-department"
          className={`${selectClass} mt-2`}
          value={department ?? String(org.department_id ?? "")}
          disabled={departments.isPending || departments.isError || mutation.isPending}
          onChange={(event) => {
            setDepartment(event.target.value);
            mutation.reset();
          }}
        >
          <option value="">Без отдела</option>
          {departments.data?.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
      <p className="text-xs text-muted-foreground">
        Изменение роли влияет на ваши права в организации.
      </p>
      <Button
        type="submit"
        variant="outline"
        disabled={mutation.isPending || (role === null && department === null)}
      >
        Сохранить данные сотрудника
      </Button>
      <Feedback
        error={mutation.error || roles.error || departments.error}
        success={mutation.isSuccess}
      />
    </form>
  );
}

function OrganizationForm({ org }: { org: MyOrganization }) {
  const qc = useQueryClient();
  const [name, setName] = useState(org.name);
  const [description, setDescription] = useState(org.description ?? "");
  const mutation = useMutation({
    mutationFn: () => orgApi.update(org.id, { name: name.trim(), description: description.trim() }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["orgs-mine"] }),
        qc.invalidateQueries({ queryKey: ["tenants"] }),
      ]);
    },
  });
  const dirty = name.trim() !== org.name || description.trim() !== (org.description ?? "");
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim() && dirty) mutation.mutate();
      }}
    >
      <div>
        <Label htmlFor="organization-name">Название</Label>
        <Input
          id="organization-name"
          className="mt-2"
          required
          value={name}
          disabled={mutation.isPending}
          onChange={(event) => {
            setName(event.target.value);
            mutation.reset();
          }}
        />
      </div>
      <div>
        <Label htmlFor="organization-description">Описание</Label>
        <textarea
          id="organization-description"
          rows={3}
          className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={description}
          disabled={mutation.isPending}
          onChange={(event) => {
            setDescription(event.target.value);
            mutation.reset();
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Эти сведения изменятся для всех участников организации.
      </p>
      <Button
        type="submit"
        variant="outline"
        disabled={mutation.isPending || !name.trim() || !dirty}
      >
        {mutation.isPending ? "Сохраняем…" : "Сохранить организацию"}
      </Button>
      <Feedback error={mutation.error} success={mutation.isSuccess} />
    </form>
  );
}
