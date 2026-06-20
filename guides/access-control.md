# Guide — Controlling access (menu, pages, buttons, fields, data)

> Audience: administrators configuring permissions in the ASUBK Credit Module.
> Based on the live test env (admin), inspected 2026-06-20 via
> `mcp__plugin_ecc_playwright` against `https://fkftest.okmot.kg/`.
> The app uses **standard Jmix security** — roles, not per-user flags.

---

## 1. The model (read this first)

Access is **never** set on a user directly. You build **roles**, then assign roles
to users. Three layers:

| Layer | Menu path | Controls | "What it answers" |
|-------|-----------|----------|-------------------|
| **Ресурсные роли** (Resource roles) | Безопасность → Ресурсные роли (`/sec/resourcerolemodels`) | menu items, pages, buttons, entity CRUD, fields | *What can the user do?* |
| **Роли уровня строк** (Row-level roles) | Безопасность → Роли уровня строк (`/sec/rowlevelrolemodels`) | which **records** are visible/editable | *Which rows can the user see?* |
| **Users** | Приложение → Users (`/users`) | accounts + role assignment | *Who gets which roles?* |

```
User ──(Назначения ролей)──> Resource role(s)  → actions / screens / entities / fields
   └────────────────────────> Row-level role(s) → JPQL row filter
```

> **Источник (Source) column.** A role is either:
> - **Аннотированный класс** — defined in Java code, **read-only** in the UI
>   (e.g. `Full Access`, `ui-minimal`, `report-run`). You cannot edit these here.
> - **База данных** — created/edited in this UI. These are the ones you manage.
>
> To control access you create/edit **База данных** roles.

---

## 2. Create a resource role

1. Безопасность → **Ресурсные роли**.
2. **Создать**.
3. Fill the header:
   - **Название** — human name (e.g. `Специалист кредитного отдела`).
   - **Код** — unique technical code (e.g. `credit-specialist`). Required.
   - **Область действия** (Scope) — check **UI** for the web app; check **API**
     only if the role is used over REST.
   - **Описание** — optional.
4. Add policies on the **Ресурсные политики** tab (next section).
5. **OK** to save.

A role with **no policies grants nothing** — see Pitfalls (§7).

---

## 3. What to restrict → which policy type

On the **Ресурсные политики** tab press **Создать** and pick the policy **Тип**.
Each type targets a different part of the UI:

| You want to control… | Policy **Тип** | **Ресурс** to enter | **Действие** |
|----------------------|----------------|---------------------|--------------|
| **Sidebar menu item** (whether the link appears) | `menu` | menu id, e.g. `Bank.list` | `Доступ` (access) |
| **A page / view** (whether the screen can open) | `screen` | view id, e.g. `Bank.list`, `Bank.detail` | `Доступ` |
| **Data operations** on an entity (drives CRUD buttons) | `entity` | entity name, e.g. `Bank` | `Чтение` / `Создание` / `Изменение` / `Удаление` |
| **A field** on a form / column | `entityAttribute` | `Entity.attr`, or `Bank.*` for all | `Изменение` (modify) / `Чтение` (view) |
| **A button / custom action / feature** | `specific` | the specific permission id | `Доступ` |

### How buttons actually get controlled

Buttons are **not** all the same — match the button to the right policy:

- **Standard list/detail buttons — Создать, Изменить, Удалить.** These follow the
  **`entity`** policy automatically. The button is enabled only if the role has the
  matching entity action:
  - **Создать** button ⇐ entity `Создание`
  - **Изменить** / save ⇐ entity `Изменение`
  - **Удалить** button ⇐ entity `Удаление`
  - list/detail visible ⇐ entity `Чтение` (+ the `screen` policy)

  > Verified on the **банки** role: it has entity `Bank` with all four actions
  > (Чтение/Создание/Изменение/Удаление), so all its CRUD buttons are active.

- **Custom buttons / non-CRUD actions** (e.g. *Одобрить*, *Отклонить*, *Назначить
  на пользователей*, export, a domain action) are gated by a **`specific`** policy.
  The developer registers a named "specific permission"; you grant it by adding a
  `specific` policy with that id. Without it the button is hidden/disabled.

  > Note: the exact list of `specific` ids is defined by the dev team. If a button
  > you need to grant is not covered by an entity action, ask the developers for
  > its specific-permission id, then add a `specific` policy for it.

### Worked example — give a role full access to the **Bank** screen

Add these policies (this is exactly how the shipped **банки** role is built):

| Тип | Ресурс | Действие |
|-----|--------|----------|
| menu | `Bank.list` | Доступ |
| screen | `Bank.list` | Доступ |
| screen | `Bank.detail` | Доступ |
| entity | `Bank` | Чтение |
| entity | `Bank` | Создание |
| entity | `Bank` | Изменение |
| entity | `Bank` | Удаление |
| entityAttribute | `Bank.*` | Изменение |

Read-only variant: drop Создание/Изменение/Удаление, keep `Чтение` and set
`entityAttribute Bank.*` → `Чтение`. The Создать/Изменить/Удалить buttons then
disappear for that user automatically.

---

## 4. Reuse via child roles (Дочерние роли)

The **Дочерние роли** tab lets a role **inherit** all policies of other roles.
Build small focused roles (e.g. one per screen) and compose a job role from them
instead of re-entering policies. A job role can be *only* child roles with no
direct policies of its own.

---

## 5. Restrict which rows a user sees (row-level)

Resource roles decide *that* a user can read `Bank`. Row-level roles decide *which*
`Bank` records.

1. Безопасность → **Роли уровня строк** → **Создать**.
2. Header: **Название**, **Код**.
3. **Политики уровня строк** tab → **Создать**:
   - **Тип**: `JPQL` (predicate) — or the predicate type your dev team provides.
   - **Имя сущности** (Entity name): e.g. `Bank`.
   - **Действие**: `Read` (and/or others).
   - **Выражение Where** (JPQL where) — the filter, e.g.
     `{E}.department.id = :current_user_department`. **An empty Where filters
     nothing** (see Pitfalls).
   - **Выражение Join** — optional extra JPQL join.
4. **OK**.

---

## 6. Assign roles to a user

Two equivalent paths:

- **From the role list:** select the role → **Назначить на пользователей**.
- **From the user:** Приложение → **Users** → select user → **Назначения ролей**
  → add the resource and/or row-level roles.

Changes take effect on the user's next login (or session refresh).

> The Users grid links each user to a **Сотрудник** (employee) → **Подразделение**
> (department). Use that link in row-level JPQL to scope data by department.

---

## 7. Pitfalls (seen on the test env — avoid these)

- **Empty role = no access.** A role with zero policies grants nothing. On the test
  env `СУГС` and `Специалист кредитного отдела` have **no policies** — any user
  given only those roles sees an empty app. Always add policies (or child roles).
- **Menu without screen/entity.** Granting only a `menu` policy shows the link but
  the page fails to open without the matching `screen` + `entity Чтение` policies.
  Grant the set together (see §3 example).
- **Forgotten entity attribute.** A form can open but fields stay blank/read-only if
  `entityAttribute` is missing. Add `Entity.*` (or specific fields).
- **Empty row-level Where does nothing.** A row-level policy with a blank
  **Выражение Where** filters no rows (the test env's `test` role is this mistake).
- **Don't edit `Аннотированный класс` roles** — they are code-owned; changes belong
  in the app source, not here.
- **Scope matters.** If a role is used in the web UI, **Область действия → UI** must
  be checked, else policies don't apply there.

---

## 8. Quick checklist

- [ ] Role is **База данных** source (editable).
- [ ] **Код** set, **Область действия = UI** checked.
- [ ] `menu` + `screen` policies for every page the user should reach.
- [ ] `entity` Чтение (+ Создание/Изменение/Удаление as needed) for each entity.
- [ ] `entityAttribute` for the fields (use `Entity.*` for all).
- [ ] `specific` policies for any custom buttons/actions.
- [ ] (Optional) row-level role with a **non-empty** Where.
- [ ] Role assigned to the user; user re-logs in.
