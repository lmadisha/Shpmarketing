import { FormEvent, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Settings as SettingsIcon, User, Database } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Separator } from "../components/ui/separator";
import { useApiClient } from "../auth/use-api-client";
import { useAuth } from "../auth/auth-context";

type ProfileDetails = {
  id: number;
  username: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  permissions: string;
  organisation_id: number | null;
  organisation_name: string | null;
  organisation_domin: string | null;
};

export function SettingsPage() {
  const { request } = useApiClient();
  const { session, setSession } = useAuth();
  const canViewTotalUnits = session?.user.permissions === "Admin" || session?.user.permissions === "Fleet Manager";
  const [profile, setProfile] = useState<ProfileDetails | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState("");
  const [profileSaveSuccess, setProfileSaveSuccess] = useState("");
  const [passwordForm, setPasswordForm] = useState({
    new_password: "",
    confirm_password: "",
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [profileForm, setProfileForm] = useState({
    first_name: "",
    last_name: "",
    username: "",
  });

  const loadProfile = async () => {
    setProfileLoading(true);
    setProfileError("");
    try {
      const data = await request<ProfileDetails>("/profile");
      setProfile(data);
      setProfileForm({
        first_name: data.first_name || "",
        last_name: data.last_name || "",
        username: data.username || "",
      });
      setProfileSaveError("");
      setProfileSaveSuccess("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load profile details.";
      setProfileError(message);
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
    // request comes from hook context and is stable enough for initial load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitProfileUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileSaveError("");
    setProfileSaveSuccess("");
    setProfileSaving(true);

    try {
      const updatedProfile = await request<ProfileDetails>("/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: profileForm.username.trim(),
          first_name: profileForm.first_name.trim(),
          last_name: profileForm.last_name.trim(),
        }),
      });

      setProfile(updatedProfile);
      setProfileForm({
        first_name: updatedProfile.first_name || "",
        last_name: updatedProfile.last_name || "",
        username: updatedProfile.username || "",
      });
      setProfileSaveSuccess("Profile updated.");

      if (session) {
        setSession({
          ...session,
          user: {
            ...session.user,
            username: updatedProfile.username,
            full_name: updatedProfile.full_name,
          },
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not update profile details.";
      setProfileSaveError(message);
    } finally {
      setProfileSaving(false);
    }
  };

  const submitPasswordChange = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    const userId = session?.user.id;
    if (!userId) {
      setPasswordError("Could not resolve current user.");
      return;
    }

    const newPassword = passwordForm.new_password;
    const confirmPassword = passwordForm.confirm_password;

    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setPasswordSaving(true);
    try {
      await request(`/users/${userId}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_password: newPassword }),
      });
      setPasswordForm({ new_password: "", confirm_password: "" });
      setPasswordSuccess("Password updated.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not update password.";
      setPasswordError(message);
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-[1440px] mx-auto">
      <h1 className="text-3xl font-semibold text-gray-900 flex items-center gap-2 mb-6">
        <SettingsIcon className="w-8 h-8 text-blue-600" />
        Settings
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Profile Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              {profileError ? <p className="text-sm text-red-600">{profileError}</p> : null}
              <form onSubmit={(event) => void submitProfileUpdate(event)} className="space-y-4">
                {profileSaveError ? <p className="text-sm text-red-600">{profileSaveError}</p> : null}
                {profileSaveSuccess ? <p className="text-sm text-green-600">{profileSaveSuccess}</p> : null}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="first-name">First Name</Label>
                    <Input
                      id="first-name"
                      value={profileForm.first_name}
                      className="mt-1.5"
                      disabled={profileLoading || profileSaving}
                      onChange={(event) => {
                        setProfileSaveSuccess("");
                        setProfileForm((prev) => ({ ...prev, first_name: event.target.value }));
                      }}
                    />
                  </div>
                  <div>
                    <Label htmlFor="last-name">Last Name</Label>
                    <Input
                      id="last-name"
                      value={profileForm.last_name}
                      className="mt-1.5"
                      disabled={profileLoading || profileSaving}
                      onChange={(event) => {
                        setProfileSaveSuccess("");
                        setProfileForm((prev) => ({ ...prev, last_name: event.target.value }));
                      }}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profileForm.username}
                    className="mt-1.5"
                    disabled={profileLoading || profileSaving}
                    onChange={(event) => {
                      setProfileSaveSuccess("");
                      setProfileForm((prev) => ({ ...prev, username: event.target.value }));
                    }}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Input
                    id="role"
                    value={profile?.permissions || ""}
                    className="mt-1.5"
                    readOnly
                    disabled={profileLoading || profileSaving}
                  />
                </div>
                <div>
                  <Label htmlFor="organisation">Organisation</Label>
                  <Input
                    id="organisation"
                    value={profile?.organisation_name || ""}
                    className="mt-1.5"
                    readOnly
                    disabled={profileLoading || profileSaving}
                  />
                </div>
                <div>
                  <Label htmlFor="organisation-domain">Organisation Domain</Label>
                  <Input
                    id="organisation-domain"
                    value={profile?.organisation_domin || ""}
                    className="mt-1.5"
                    readOnly
                    disabled={profileLoading || profileSaving}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={profileLoading || profileSaving}>
                    {profileSaving ? "Saving..." : "Save Profile"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void loadProfile()}
                    disabled={profileLoading || profileSaving}
                  >
                    {profileLoading ? "Refreshing..." : "Refresh Profile"}
                  </Button>
                </div>
              </form>

              <Separator className="my-6" />

              <form onSubmit={(event) => void submitPasswordChange(event)} className="space-y-4">
                <h3 className="text-sm font-medium">Change Password</h3>
                {passwordError ? <p className="text-sm text-red-600">{passwordError}</p> : null}
                {passwordSuccess ? <p className="text-sm text-green-600">{passwordSuccess}</p> : null}
                <div>
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={passwordForm.new_password}
                    className="mt-1.5"
                    disabled={passwordSaving || profileLoading}
                    onChange={(event) => {
                      setPasswordSuccess("");
                      setPasswordForm((prev) => ({ ...prev, new_password: event.target.value }));
                    }}
                  />
                </div>
                <div>
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={passwordForm.confirm_password}
                    className="mt-1.5"
                    disabled={passwordSaving || profileLoading}
                    onChange={(event) => {
                      setPasswordSuccess("");
                      setPasswordForm((prev) => ({ ...prev, confirm_password: event.target.value }));
                    }}
                  />
                </div>
                <Button type="submit" disabled={passwordSaving || profileLoading}>
                  {passwordSaving ? "Updating..." : "Update Password"}
                </Button>
              </form>
            </CardContent>
          </Card>

        </div>

        {/* Side Panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                System Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Version</p>
                <p className="font-medium">Frostlink v1.2.4</p>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-gray-600">Last Data Sync</p>
                <p className="font-medium">2 minutes ago</p>
              </div>
              {canViewTotalUnits ? (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-gray-600">Total Units</p>
                    <p className="font-medium">624 active</p>
                  </div>
                </>
              ) : null}
              <Separator />
              <div>
                <p className="text-sm text-gray-600">Data Retention</p>
                <p className="font-medium">90 days</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
