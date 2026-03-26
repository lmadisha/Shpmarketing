import { FormEvent, useEffect, useMemo, useState } from "react";
import { Users, RefreshCw, Plus, KeyRound, ShieldCheck, Building2, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { AccessDeniedCard } from "../components/auth/access-denied-card";
import { useApiClient } from "../auth/use-api-client";
import { PermissionLevel, useAuth } from "../auth/auth-context";
import { hasPermission, USER_PERMISSION_LEVELS } from "../auth/permission-policy";

type WorkspaceUser = {
  id: number;
  username: string;
  full_name: string | null;
  permissions: PermissionLevel;
  is_active: boolean;
  created_at: string;
  organisation_id: number | null;
  organisation_name?: string | null;
};

type OrganisationOption = {
  id: number;
  name: string;
  domin: string | null;
  created_at?: string;
};

type StatusFilter = "all" | "active" | "inactive";

export function WorkspacePage() {
  const { request } = useApiClient();
  const { session } = useAuth();

  const permissionLevel = session?.user.permissions;
  const selfUserId = session?.user.id ?? null;
  const selfOrgId = session?.user.organisation_id ?? null;
  const isAdmin = permissionLevel === "Admin";
  const forceOwnOrg = !isAdmin && selfOrgId != null;
  const canViewUsers = permissionLevel ? hasPermission(permissionLevel, "users.view") : false;
  const canManageUsers = permissionLevel ? hasPermission(permissionLevel, "users.manage") : false;

  const [users, setUsers] = useState<WorkspaceUser[]>([]);
  const [organisations, setOrganisations] = useState<OrganisationOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [permissionFilter, setPermissionFilter] = useState<PermissionLevel | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [organisationFilter, setOrganisationFilter] = useState("all");

  const [organisationCreateForm, setOrganisationCreateForm] = useState({
    name: "",
    domin: "",
  });
  const [organisationCreateSubmitting, setOrganisationCreateSubmitting] = useState(false);
  const [organisationCreateError, setOrganisationCreateError] = useState("");
  const [organisationDeleteModal, setOrganisationDeleteModal] = useState<{
    open: boolean;
    organisation: OrganisationOption | null;
    submitting: boolean;
    error: string;
  }>({
    open: false,
    organisation: null,
    submitting: false,
    error: "",
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createForm, setCreateForm] = useState({
    full_name: "",
    username: "",
    password: "",
    permissions: "User" as PermissionLevel,
    organisation_id: forceOwnOrg ? String(selfOrgId) : "",
  });

  const [permissionModal, setPermissionModal] = useState<{
    open: boolean;
    user: WorkspaceUser | null;
    nextPermission: PermissionLevel;
    submitting: boolean;
    error: string;
  }>({
    open: false,
    user: null,
    nextPermission: "User",
    submitting: false,
    error: "",
  });

  const [passwordModal, setPasswordModal] = useState<{
    open: boolean;
    user: WorkspaceUser | null;
    password: string;
    submitting: boolean;
    error: string;
  }>({
    open: false,
    user: null,
    password: "",
    submitting: false,
    error: "",
  });

  const loadUsers = async () => {
    if (!canViewUsers) {
      setUsers([]);
      setError("You do not have permission to view users.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const usersPath =
        isAdmin && organisationFilter !== "all"
          ? `/users?organisation_id=${encodeURIComponent(organisationFilter)}`
          : "/users";
      const data = await request<WorkspaceUser[]>(usersPath);
      setUsers(Array.isArray(data) ? data : []);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Could not load users.";
      setError(message);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const loadOrganisations = async () => {
    if (!isAdmin) {
      setOrganisations([]);
      setOrganisationFilter("all");
      return;
    }

    try {
      const data = await request<OrganisationOption[]>("/organisations");
      setOrganisations(Array.isArray(data) ? data : []);
    } catch {
      setOrganisations([]);
      setOrganisationFilter("all");
    }
  };

  useEffect(() => {
    void loadUsers();
    // request is provided by context and is stable enough for initial load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canViewUsers, isAdmin, organisationFilter]);

  useEffect(() => {
    void loadOrganisations();
    // request is provided by context and is stable enough for initial load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin || organisationFilter === "all") {
      return;
    }
    const selectedStillExists = organisations.some((org) => String(org.id) === organisationFilter);
    if (!selectedStillExists) {
      setOrganisationFilter("all");
    }
  }, [isAdmin, organisationFilter, organisations]);

  const submitCreateOrganisation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isAdmin) return;

    setOrganisationCreateError("");
    setOrganisationCreateSubmitting(true);
    try {
      await request<OrganisationOption>("/organisations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: organisationCreateForm.name.trim(),
          domin: organisationCreateForm.domin.trim() || null,
        }),
      });

      setOrganisationCreateForm({ name: "", domin: "" });
      await loadOrganisations();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Could not create organisation.";
      setOrganisationCreateError(message);
    } finally {
      setOrganisationCreateSubmitting(false);
    }
  };

  const confirmDeleteOrganisation = async () => {
    const selectedOrganisation = organisationDeleteModal.organisation;
    if (!isAdmin || !selectedOrganisation) return;

    setOrganisationDeleteModal((prev) => ({ ...prev, submitting: true, error: "" }));
    try {
      await request(`/organisations/${selectedOrganisation.id}`, {
        method: "DELETE",
      });

      if (organisationFilter === String(selectedOrganisation.id)) {
        setOrganisationFilter("all");
      } else {
        await loadUsers();
      }

      setOrganisationDeleteModal({
        open: false,
        organisation: null,
        submitting: false,
        error: "",
      });
      await loadOrganisations();
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Could not delete organisation.";
      setOrganisationDeleteModal((prev) => ({
        ...prev,
        submitting: false,
        error: message,
      }));
    }
  };

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return users.filter((user) => {
      if (permissionFilter !== "all" && user.permissions !== permissionFilter) {
        return false;
      }

      if (statusFilter === "active" && !user.is_active) {
        return false;
      }

      if (statusFilter === "inactive" && user.is_active) {
        return false;
      }

      if (!term) {
        return true;
      }

      const haystack = [
        user.full_name || "",
        user.username || "",
        user.organisation_name || "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [users, searchTerm, permissionFilter, statusFilter]);

  const visiblePermissionGroups = useMemo(() => {
    if (permissionFilter === "all") {
      return USER_PERMISSION_LEVELS;
    }
    return [permissionFilter];
  }, [permissionFilter]);

  const groupedUsers = useMemo(() => {
    return visiblePermissionGroups.map((level) => ({
      level,
      rows: filteredUsers.filter((user) => user.permissions === level),
    }));
  }, [filteredUsers, visiblePermissionGroups]);

  const openPermissionModal = (user: WorkspaceUser) => {
    setPermissionModal({
      open: true,
      user,
      nextPermission: user.permissions,
      submitting: false,
      error: "",
    });
  };

  const submitPermissionChange = async () => {
    if (!permissionModal.user) return;

    setPermissionModal((prev) => ({ ...prev, submitting: true, error: "" }));
    try {
      await request(`/users/${permissionModal.user.id}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: permissionModal.nextPermission }),
      });
      setPermissionModal({
        open: false,
        user: null,
        nextPermission: "User",
        submitting: false,
        error: "",
      });
      await loadUsers();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Could not update user permission.";
      setPermissionModal((prev) => ({ ...prev, submitting: false, error: message }));
    }
  };

  const openPasswordModal = (user: WorkspaceUser) => {
    setPasswordModal({
      open: true,
      user,
      password: "",
      submitting: false,
      error: "",
    });
  };

  const submitPasswordReset = async () => {
    if (!passwordModal.user) return;
    if (passwordModal.password.length < 8) {
      setPasswordModal((prev) => ({
        ...prev,
        error: "Password must be at least 8 characters.",
      }));
      return;
    }

    setPasswordModal((prev) => ({ ...prev, submitting: true, error: "" }));
    try {
      await request(`/users/${passwordModal.user.id}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_password: passwordModal.password }),
      });
      setPasswordModal({
        open: false,
        user: null,
        password: "",
        submitting: false,
        error: "",
      });
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Could not reset password.";
      setPasswordModal((prev) => ({ ...prev, submitting: false, error: message }));
    }
  };

  const submitCreateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateError("");
    setCreateSubmitting(true);

    try {
      const organisationId =
        createForm.organisation_id.trim() !== ""
          ? Number(createForm.organisation_id)
          : null;

      if (!forceOwnOrg && organisationId == null) {
        setCreateError("Organisation is required.");
        setCreateSubmitting(false);
        return;
      }

      await request("/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: createForm.full_name.trim(),
          username: createForm.username.trim(),
          password: createForm.password,
          permissions: createForm.permissions,
          organisation_id: forceOwnOrg ? selfOrgId : organisationId,
        }),
      });

      setCreateOpen(false);
      setCreateForm({
        full_name: "",
        username: "",
        password: "",
        permissions: "User",
        organisation_id: forceOwnOrg ? String(selfOrgId) : "",
      });
      await loadUsers();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Could not create user.";
      setCreateError(message);
    } finally {
      setCreateSubmitting(false);
    }
  };

  const toggleActive = async (user: WorkspaceUser) => {
    try {
      await request(`/users/${user.id}/active`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !user.is_active }),
      });
      await loadUsers();
    } catch (toggleError) {
      const message = toggleError instanceof Error ? toggleError.message : "Could not update user status.";
      setError(message);
    }
  };

  if (!canViewUsers) {
    return (
      <AccessDeniedCard
        title="Workspace access denied"
        description="You do not have permission to view workspace users."
      />
    );
  }

  return (
    <div className="p-8 max-w-[1440px] mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Workspace
          </CardTitle>
          <CardDescription>View and manage users grouped by permission level.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={`grid grid-cols-1 gap-3 ${isAdmin ? "md:grid-cols-5" : "md:grid-cols-4"}`}>
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search name, email, organisation"
            />
            <Select value={permissionFilter} onValueChange={(value) => setPermissionFilter(value as PermissionLevel | "all")}>
              <SelectTrigger>
                <SelectValue placeholder="Filter permission" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All permissions</SelectItem>
                {USER_PERMISSION_LEVELS.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
              <SelectTrigger>
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            {isAdmin ? (
              <Select value={organisationFilter} onValueChange={setOrganisationFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter organisation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All organisations</SelectItem>
                  {organisations.map((organisation) => (
                    <SelectItem key={organisation.id} value={String(organisation.id)}>
                      {organisation.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => void loadUsers()} disabled={loading}>
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              {canManageUsers ? (
                <Button
                  onClick={() => {
                    setCreateError("");
                    setCreateOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Add User
                </Button>
              ) : null}
            </div>
          </div>

          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : null}
        </CardContent>
      </Card>

      {isAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              Organisations
            </CardTitle>
            <CardDescription>Create or delete organisations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={(event) => void submitCreateOrganisation(event)} className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="organisation-name">Organisation Name</Label>
                <Input
                  id="organisation-name"
                  value={organisationCreateForm.name}
                  onChange={(event) =>
                    setOrganisationCreateForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="Organisation name"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="organisation-domin">Email Domain</Label>
                <Input
                  id="organisation-domin"
                  value={organisationCreateForm.domin}
                  onChange={(event) =>
                    setOrganisationCreateForm((prev) => ({ ...prev, domin: event.target.value }))
                  }
                  placeholder="example.com"
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" className="w-full" disabled={organisationCreateSubmitting}>
                  {organisationCreateSubmitting ? "Creating..." : "Add Organisation"}
                </Button>
              </div>
            </form>

            {organisationCreateError ? (
              <p className="text-sm text-red-600">{organisationCreateError}</p>
            ) : null}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organisations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-sm text-muted-foreground">
                      No organisations found.
                    </TableCell>
                  </TableRow>
                ) : (
                  organisations.map((organisation) => (
                    <TableRow key={organisation.id}>
                      <TableCell>{organisation.name}</TableCell>
                      <TableCell>{organisation.domin || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setOrganisationDeleteModal({
                              open: true,
                              organisation,
                              submitting: false,
                              error: "",
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {groupedUsers.map((group) => (
        <Card key={group.level}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-3">
              <span>{group.level}</span>
              <Badge variant="outline">{group.rows.length}</Badge>
            </CardTitle>
            <CardDescription>Users assigned to {group.level}.</CardDescription>
          </CardHeader>
          <CardContent>
            {group.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No users in this permission group for current filters.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Full Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Organisation</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.rows.map((user) => {
                    const isSelf = selfUserId === user.id;
                    const canDeactivate = !(isSelf && user.is_active);
                    return (
                      <TableRow key={user.id}>
                        <TableCell>{user.full_name || "-"}</TableCell>
                        <TableCell>{user.username}</TableCell>
                        <TableCell>{user.organisation_name || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={user.is_active ? "default" : "secondary"}>
                            {user.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(user.created_at).toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          {canManageUsers ? (
                            <div className="inline-flex gap-2 justify-end flex-wrap">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openPermissionModal(user)}
                              >
                                <ShieldCheck className="h-4 w-4" />
                                Role
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openPasswordModal(user)}
                              >
                                <KeyRound className="h-4 w-4" />
                                Password
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void toggleActive(user)}
                                disabled={loading || !canDeactivate}
                              >
                                {user.is_active ? "Deactivate" : "Activate"}
                              </Button>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">View only</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ))}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
            <DialogDescription>Create a new workspace user.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => void submitCreateUser(event)} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="create-full-name">Full Name</Label>
              <Input
                id="create-full-name"
                value={createForm.full_name}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, full_name: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="create-email">Email</Label>
              <Input
                id="create-email"
                type="email"
                value={createForm.username}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, username: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="create-password">Password</Label>
              <Input
                id="create-password"
                type="password"
                value={createForm.password}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, password: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Permission</Label>
              <Select
                value={createForm.permissions}
                onValueChange={(value) =>
                  setCreateForm((prev) => ({ ...prev, permissions: value as PermissionLevel }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select permission" />
                </SelectTrigger>
                <SelectContent>
                  {USER_PERMISSION_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Organisation</Label>
              <Select
                value={createForm.organisation_id}
                onValueChange={(value) => setCreateForm((prev) => ({ ...prev, organisation_id: value }))}
                disabled={forceOwnOrg}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select organisation" />
                </SelectTrigger>
                <SelectContent>
                  {organisations.map((org) => (
                    <SelectItem key={org.id} value={String(org.id)}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {createError ? <p className="text-sm text-red-600">{createError}</p> : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createSubmitting}>
                {createSubmitting ? "Creating..." : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={organisationDeleteModal.open}
        onOpenChange={(open) =>
          setOrganisationDeleteModal((prev) =>
            open
              ? prev
              : { open: false, organisation: null, submitting: false, error: "" },
          )
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Organisation</DialogTitle>
            <DialogDescription>
              Delete {organisationDeleteModal.organisation?.name}? This action is blocked if users or fridges are still linked.
            </DialogDescription>
          </DialogHeader>
          {organisationDeleteModal.error ? (
            <p className="text-sm text-red-600">{organisationDeleteModal.error}</p>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setOrganisationDeleteModal({
                  open: false,
                  organisation: null,
                  submitting: false,
                  error: "",
                })
              }
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmDeleteOrganisation()}
              disabled={organisationDeleteModal.submitting}
            >
              {organisationDeleteModal.submitting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={permissionModal.open}
        onOpenChange={(open) =>
          setPermissionModal((prev) =>
            open ? prev : { open: false, user: null, nextPermission: "User", submitting: false, error: "" },
          )
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update User Permission</DialogTitle>
            <DialogDescription>Change the assigned role for this user.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{permissionModal.user?.username}</p>
            <Select
              value={permissionModal.nextPermission}
              onValueChange={(value) =>
                setPermissionModal((prev) => ({ ...prev, nextPermission: value as PermissionLevel }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {USER_PERMISSION_LEVELS.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {permissionModal.error ? <p className="text-sm text-red-600">{permissionModal.error}</p> : null}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setPermissionModal({ open: false, user: null, nextPermission: "User", submitting: false, error: "" })
              }
            >
              Cancel
            </Button>
            <Button onClick={() => void submitPermissionChange()} disabled={permissionModal.submitting}>
              {permissionModal.submitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={passwordModal.open}
        onOpenChange={(open) =>
          setPasswordModal((prev) =>
            open ? prev : { open: false, user: null, password: "", submitting: false, error: "" },
          )
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset User Password</DialogTitle>
            <DialogDescription>Set a new password for {passwordModal.user?.username}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              type="password"
              value={passwordModal.password}
              onChange={(event) => setPasswordModal((prev) => ({ ...prev, password: event.target.value }))}
              placeholder="New password (min 8 characters)"
            />
            {passwordModal.error ? <p className="text-sm text-red-600">{passwordModal.error}</p> : null}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPasswordModal({ open: false, user: null, password: "", submitting: false, error: "" })}
            >
              Cancel
            </Button>
            <Button onClick={() => void submitPasswordReset()} disabled={passwordModal.submitting}>
              {passwordModal.submitting ? "Updating..." : "Update Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
