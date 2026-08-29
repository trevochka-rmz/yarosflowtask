import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  api,
  PRIORITY_LABELS,
  STATUS_LABELS,
  type Priority,
  type Task,
  type TaskStatus,
} from "@/lib/api";

function toDateInput(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export function TaskEditForm({
  task,
  userId,
  tenantId,
  onDone,
}: {
  task: Task;
  userId: number;
  tenantId: number;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: task.title,
    description: task.description ?? "",
    acceptance_criteria: task.acceptance_criteria ?? "",
    priority: task.priority,
    status: task.status,
    category: task.category ?? "",
    deadline: toDateInput(task.deadline),
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.updateTask(task.id, tenantId, {
        title: form.title,
        description: form.description,
        acceptance_criteria: form.acceptance_criteria,
        priority: form.priority,
        status: form.status,
        category: form.category || null,
        deadline: form.deadline ? new Date(`${form.deadline}T00:00:00.000Z`).toISOString() : null,
        changedBy: userId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task", task.id] });
      queryClient.invalidateQueries({ queryKey: ["history", task.id] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks-board"] });
      toast.success("Задача обновлена");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const field = "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

  return (
    <div className="space-y-4 px-4 py-4 sm:px-6">
      <label className="block text-sm">
        <span className="font-medium text-muted-foreground">Название</span>
        <Input
          className="mt-1"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-muted-foreground">Описание</span>
        <Textarea
          className="mt-1 min-h-28"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-muted-foreground">Критерии приёмки</span>
        <Textarea
          className="mt-1 min-h-24"
          value={form.acceptance_criteria}
          onChange={(e) => setForm((f) => ({ ...f, acceptance_criteria: e.target.value }))}
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-muted-foreground">Приоритет</span>
          <select
            className={field}
            value={form.priority}
            onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as Priority }))}
          >
            {Object.entries(PRIORITY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-muted-foreground">Статус</span>
          <select
            className={field}
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as TaskStatus }))}
          >
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-muted-foreground">Категория</span>
          <Input
            className="mt-1"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-muted-foreground">Дедлайн</span>
          <Input
            type="date"
            className="mt-1"
            value={form.deadline}
            onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
          />
        </label>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          className="w-full sm:w-auto"
          disabled={mutation.isPending || !form.title.trim()}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Сохранить"}
        </Button>
        <Button variant="outline" className="w-full sm:w-auto" onClick={onDone}>
          Отмена
        </Button>
      </div>
    </div>
  );
}
