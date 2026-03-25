import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { PermissionLevel, useAuth } from "../auth/auth-context";
import { loggedFetch } from "../auth/logged-fetch";
import { USER_PERMISSION_LEVELS } from "../auth/permission-policy";

const API_BASE =
  (import.meta.env.VITE_OPERATIONS_API_BASE as string | undefined) ||
  "http://localhost:5001";

type OrganisationOption = {
  id: number;
  name: string;
  domin: string | null;
};

export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    full_name: "",
    username: "",
    password: "",
    permissions: "User" as PermissionLevel,
    organisation_id: "",
  });
  const [organisations, setOrganisations] = useState<OrganisationOption[]>([]);
  const [organisationsLoading, setOrganisationsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadOrganisations = async () => {
      setOrganisationsLoading(true);
      try {
        const response = await loggedFetch(`${API_BASE}/organisations`);
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(
            (data && typeof data === "object" && "error" in data && String(data.error)) ||
            "Could not load organisations",
          );
        }

        setOrganisations(Array.isArray(data) ? data : []);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Could not load organisations";
        setError(message);
      } finally {
        setOrganisationsLoading(false);
      }
    };

    void loadOrganisations();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    const organisationId = Number(form.organisation_id);
    if (!Number.isInteger(organisationId) || organisationId <= 0) {
      setError("Please select an organisation.");
      setSubmitting(false);
      return;
    }

    try {
      await signup({
        full_name: form.full_name.trim(),
        username: form.username.trim(),
        password: form.password,
        permissions: form.permissions,
        organisation_id: organisationId,
      });
      navigate("/", { replace: true });
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Signup failed";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create account</CardTitle>
          <CardDescription>Register for SHP Marketing access.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="full_name">Full name</Label>
              <Input
                id="full_name"
                autoComplete="name"
                value={form.full_name}
                onChange={(event) => setForm((prev) => ({ ...prev, full_name: event.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup_email">Email</Label>
              <Input
                id="signup_email"
                type="email"
                autoComplete="email"
                value={form.username}
                onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signup_password">Password</Label>
              <Input
                id="signup_password"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Permission</Label>
              <Select
                value={form.permissions}
                onValueChange={(value) => setForm((prev) => ({ ...prev, permissions: value as PermissionLevel }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select permission" />
                </SelectTrigger>
                <SelectContent>
                  {USER_PERMISSION_LEVELS.map((permission) => (
                    <SelectItem key={permission} value={permission}>
                      {permission}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Organisation</Label>
              <Select
                value={form.organisation_id}
                onValueChange={(value) => setForm((prev) => ({ ...prev, organisation_id: value }))}
                disabled={organisationsLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={organisationsLoading ? "Loading organisations..." : "Select organisation"} />
                </SelectTrigger>
                <SelectContent>
                  {organisations.map((organisation) => (
                    <SelectItem key={organisation.id} value={String(organisation.id)}>
                      {organisation.name}{organisation.domin ? ` (${organisation.domin})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Creating account..." : "Create account"}
            </Button>

            <p className="text-sm text-gray-600 text-center">
              Already have an account? <Link className="text-blue-600 hover:underline" to="/login">Sign in</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
