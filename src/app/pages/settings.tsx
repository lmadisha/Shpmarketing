import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Settings as SettingsIcon, Bell, User, Palette, Database } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Separator } from "../components/ui/separator";
import { useApiClient } from "../auth/use-api-client";

type ProfileDetails = {
  id: number;
  username: string;
  full_name: string | null;
  permissions: string;
  organisation_id: number | null;
  organisation_name: string | null;
  organisation_domin: string | null;
};

export function SettingsPage() {
  const { request } = useApiClient();
  const [profile, setProfile] = useState<ProfileDetails | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");

  const loadProfile = async () => {
    setProfileLoading(true);
    setProfileError("");
    try {
      const data = await request<ProfileDetails>("/profile");
      setProfile(data);
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

  const fullName = String(profile?.full_name || "").trim();
  const [firstName = "", ...lastNameParts] = fullName ? fullName.split(/\s+/) : [];
  const lastName = lastNameParts.join(" ");

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
            <CardContent className="space-y-4">
              {profileError ? <p className="text-sm text-red-600">{profileError}</p> : null}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first-name">First Name</Label>
                  <Input id="first-name" value={firstName} className="mt-1.5" readOnly disabled={profileLoading} />
                </div>
                <div>
                  <Label htmlFor="last-name">Last Name</Label>
                  <Input id="last-name" value={lastName} className="mt-1.5" readOnly disabled={profileLoading} />
                </div>
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={profile?.username || ""}
                  className="mt-1.5"
                  readOnly
                  disabled={profileLoading}
                />
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Input
                  id="role"
                  value={profile?.permissions || ""}
                  className="mt-1.5"
                  readOnly
                  disabled={profileLoading}
                />
              </div>
              <div>
                <Label htmlFor="organisation">Organisation</Label>
                <Input
                  id="organisation"
                  value={profile?.organisation_name || ""}
                  className="mt-1.5"
                  readOnly
                  disabled={profileLoading}
                />
              </div>
              <div>
                <Label htmlFor="organisation-domain">Organisation Domain</Label>
                <Input
                  id="organisation-domain"
                  value={profile?.organisation_domin || ""}
                  className="mt-1.5"
                  readOnly
                  disabled={profileLoading}
                />
              </div>
              <Button type="button" variant="outline" onClick={() => void loadProfile()} disabled={profileLoading}>
                {profileLoading ? "Refreshing..." : "Refresh Profile"}
              </Button>
            </CardContent>
          </Card>

          {/* Notification Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notification Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="email-notifications">Email Notifications</Label>
                  <p className="text-sm text-gray-600">
                    Receive email alerts for critical events
                  </p>
                </div>
                <Switch id="email-notifications" defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="tier-changes">Tier Change Alerts</Label>
                  <p className="text-sm text-gray-600">
                    Get notified when units change tiers
                  </p>
                </div>
                <Switch id="tier-changes" defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="temp-alerts">Temperature Alerts</Label>
                  <p className="text-sm text-gray-600">
                    Alert for temperature compliance issues
                  </p>
                </div>
                <Switch id="temp-alerts" defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="voltage-alerts">Voltage Risk Alerts</Label>
                  <p className="text-sm text-gray-600">
                    Alert for voltage anomalies
                  </p>
                </div>
                <Switch id="voltage-alerts" defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="weekly-summary">Weekly Summary Report</Label>
                  <p className="text-sm text-gray-600">
                    Receive weekly performance summaries
                  </p>
                </div>
                <Switch id="weekly-summary" defaultChecked />
              </div>
            </CardContent>
          </Card>

          {/* Dashboard Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5" />
                Dashboard Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="dark-mode">Dark Mode</Label>
                  <p className="text-sm text-gray-600">
                    Use dark theme for the dashboard
                  </p>
                </div>
                <Switch id="dark-mode" />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="compact-view">Compact View</Label>
                  <p className="text-sm text-gray-600">
                    Show more data in less space
                  </p>
                </div>
                <Switch id="compact-view" />
              </div>
              <Separator />
              <div>
                <Label htmlFor="default-date-range">Default Date Range</Label>
                <Input
                  id="default-date-range"
                  defaultValue="Last 30 days"
                  className="mt-1.5"
                />
              </div>
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
              <Separator />
              <div>
                <p className="text-sm text-gray-600">Total Units</p>
                <p className="font-medium">624 active</p>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-gray-600">Data Retention</p>
                <p className="font-medium">90 days</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full">
                Export All Data
              </Button>
              <Button variant="outline" className="w-full">
                Generate Report
              </Button>
              <Button variant="outline" className="w-full">
                View Audit Log
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
