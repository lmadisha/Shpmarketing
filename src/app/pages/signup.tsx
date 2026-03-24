import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { PermissionLevel, useAuth } from "../auth/auth-context";

export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    full_name: "",
    username: "",
    password: "",
    permissions: "Basic" as PermissionLevel,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await signup({
        full_name: form.full_name.trim(),
        username: form.username.trim(),
        password: form.password,
        permissions: form.permissions,
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
                  <SelectItem value="Basic">Basic</SelectItem>
                  <SelectItem value="Intermediate">Intermediate</SelectItem>
                  <SelectItem value="Admin">Admin</SelectItem>
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