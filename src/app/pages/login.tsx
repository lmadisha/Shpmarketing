import { FormEvent, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { useAuth } from "../auth/auth-context";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const nextPath = useMemo(() => {
    const state = location.state as { from?: { pathname?: string } } | null;
    return state?.from?.pathname || "/";
  }, [location.state]);

  const [form, setForm] = useState({ username: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await login({ username: form.username.trim(), password: form.password });
      navigate(nextPath, { replace: true });
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Login failed";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Sign in to access SHP Marketing operations and analytics.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="username">Email</Label>
              <Input
                id="username"
                type="email"
                autoComplete="email"
                value={form.username}
                onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                required
              />
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Signing in..." : "Sign in"}
            </Button>

            <p className="text-sm text-gray-600 text-center">
              No account yet? <Link className="text-blue-600 hover:underline" to="/signup">Create one</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}