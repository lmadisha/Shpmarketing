import { useEffect, useMemo, useState } from "react";
import { Ruler } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { useApiClient } from "../../auth/use-api-client";
import { useAuth } from "../../auth/auth-context";
import {
  type OrganisationAssetValidationRules,
  validateOrganisationAssetValidationForm,
} from "../../lib/organisation-asset-validation";

type OrganisationOption = {
  id: number;
  name: string;
  domin: string | null;
};

type RulesFormState = {
  serial_min_length: string;
  serial_max_length: string;
  mac_min_length: string;
  mac_max_length: string;
  c_number_min_length: string;
  c_number_max_length: string;
};

const EMPTY_RULES_FORM: RulesFormState = {
  serial_min_length: "",
  serial_max_length: "",
  mac_min_length: "",
  mac_max_length: "",
  c_number_min_length: "",
  c_number_max_length: "",
};

function toFormState(rules: OrganisationAssetValidationRules): RulesFormState {
  return {
    serial_min_length: String(rules.serial_min_length),
    serial_max_length: String(rules.serial_max_length),
    mac_min_length: String(rules.mac_min_length),
    mac_max_length: String(rules.mac_max_length),
    c_number_min_length: String(rules.c_number_min_length),
    c_number_max_length: String(rules.c_number_max_length),
  };
}

export function OrganisationAssetValidationSettingsCard() {
  const { request } = useApiClient();
  const { session } = useAuth();
  const isAdmin = session?.user.permissions === "Admin";
  const isFleetManager = session?.user.permissions === "Fleet Manager";
  const canManageRules = isAdmin || isFleetManager;

  const [organisationOptions, setOrganisationOptions] = useState<OrganisationOption[]>([]);
  const [organisationsLoading, setOrganisationsLoading] = useState(false);
  const [selectedOrganisationId, setSelectedOrganisationId] = useState("");
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesSaving, setRulesSaving] = useState(false);
  const [rulesError, setRulesError] = useState("");
  const [rulesSuccess, setRulesSuccess] = useState("");
  const [rulesForm, setRulesForm] = useState<RulesFormState>(EMPTY_RULES_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const effectiveOrganisationId = useMemo(() => {
    if (isAdmin) {
      return selectedOrganisationId ? Number(selectedOrganisationId) : null;
    }
    return session?.user.organisation_id ?? null;
  }, [isAdmin, selectedOrganisationId, session?.user.organisation_id]);

  const loadRules = async (organisationId?: number | null) => {
    if (!canManageRules) {
      return;
    }

    const params = new URLSearchParams();
    if (isAdmin && organisationId) {
      params.set("organisation_id", String(organisationId));
    }

    setRulesLoading(true);
    setRulesError("");
    setRulesSuccess("");
    try {
      const path = params.toString()
        ? `/organisation-asset-validation?${params.toString()}`
        : "/organisation-asset-validation";
      const rules = await request<OrganisationAssetValidationRules>(path);
      setRulesForm(toFormState(rules));
      setFieldErrors({});
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load asset validation rules.";
      setRulesError(message);
    } finally {
      setRulesLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    let cancelled = false;
    const loadOrganisations = async () => {
      setOrganisationsLoading(true);
      try {
        const data = await request<OrganisationOption[]>("/organisations");
        if (cancelled) {
          return;
        }

        setOrganisationOptions(Array.isArray(data) ? data : []);
        const preferredOrganisationId = session?.user.organisation_id
          ? String(session.user.organisation_id)
          : data[0]
            ? String(data[0].id)
            : "";
        setSelectedOrganisationId(preferredOrganisationId);
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Could not load organisations.";
          setRulesError(message);
          setOrganisationOptions([]);
          setSelectedOrganisationId("");
        }
      } finally {
        if (!cancelled) {
          setOrganisationsLoading(false);
        }
      }
    };

    void loadOrganisations();
    return () => {
      cancelled = true;
    };
    // request is intentionally excluded; the hook recreates it and would cause a render loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, session?.user.organisation_id]);

  useEffect(() => {
    if (!canManageRules) {
      return;
    }
    if (!effectiveOrganisationId) {
      return;
    }
    void loadRules(effectiveOrganisationId);
    // loadRules is intentionally excluded because it is recreated each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageRules, effectiveOrganisationId]);

  if (!canManageRules) {
    return null;
  }

  const saveRules = async () => {
    if (!effectiveOrganisationId) {
      setRulesError("Select an organisation first.");
      return;
    }

    const validation = validateOrganisationAssetValidationForm(rulesForm);
    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      setRulesError(Object.values(validation.errors)[0] || "Validation failed.");
      setRulesSuccess("");
      return;
    }

    setRulesSaving(true);
    setRulesError("");
    setRulesSuccess("");
    try {
      const payload = {
        organisation_id: effectiveOrganisationId,
        ...validation.values,
      };
      const rules = await request<OrganisationAssetValidationRules>("/organisation-asset-validation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setRulesForm(toFormState(rules));
      setFieldErrors({});
      setRulesSuccess("Organisation asset validation rules updated.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not update asset validation rules.";
      setRulesError(message);
    } finally {
      setRulesSaving(false);
    }
  };

  const handleFieldChange = (field: keyof RulesFormState, value: string) => {
    setRulesSuccess("");
    setRulesError("");
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
    setRulesForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ruler className="w-5 h-5" />
          Organisation Asset Validation
        </CardTitle>
        <CardDescription>
          Configure allowed min and max lengths for serial numbers, MAC addresses, and C-numbers per organisation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAdmin ? (
          <div>
            <Label htmlFor="asset-validation-organisation">Organisation</Label>
            <Select
              value={selectedOrganisationId}
              onValueChange={(value) => {
                setSelectedOrganisationId(value);
                setRulesSuccess("");
                setRulesError("");
                setFieldErrors({});
              }}
              disabled={organisationsLoading || rulesSaving}
            >
              <SelectTrigger id="asset-validation-organisation" className="mt-1.5">
                <SelectValue placeholder={organisationsLoading ? "Loading organisations..." : "Select organisation"} />
              </SelectTrigger>
              <SelectContent>
                {organisationOptions.map((organisation) => (
                  <SelectItem key={organisation.id} value={String(organisation.id)}>
                    {organisation.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {rulesError ? <p className="text-sm text-red-600">{rulesError}</p> : null}
        {rulesSuccess ? <p className="text-sm text-green-600">{rulesSuccess}</p> : null}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-3">
            <div>
              <Label htmlFor="serial-min-length">Serial Minimum Length</Label>
              <Input
                id="serial-min-length"
                type="number"
                min={1}
                value={rulesForm.serial_min_length}
                className="mt-1.5"
                disabled={rulesLoading || rulesSaving || !effectiveOrganisationId}
                onChange={(event) => handleFieldChange("serial_min_length", event.target.value)}
              />
              {fieldErrors.serial_min_length ? <p className="text-xs text-red-600 mt-1">{fieldErrors.serial_min_length}</p> : null}
            </div>
            <div>
              <Label htmlFor="serial-max-length">Serial Maximum Length</Label>
              <Input
                id="serial-max-length"
                type="number"
                min={1}
                value={rulesForm.serial_max_length}
                className="mt-1.5"
                disabled={rulesLoading || rulesSaving || !effectiveOrganisationId}
                onChange={(event) => handleFieldChange("serial_max_length", event.target.value)}
              />
              {fieldErrors.serial_max_length ? <p className="text-xs text-red-600 mt-1">{fieldErrors.serial_max_length}</p> : null}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <Label htmlFor="mac-min-length">MAC Minimum Length</Label>
              <Input
                id="mac-min-length"
                type="number"
                min={1}
                value={rulesForm.mac_min_length}
                className="mt-1.5"
                disabled={rulesLoading || rulesSaving || !effectiveOrganisationId}
                onChange={(event) => handleFieldChange("mac_min_length", event.target.value)}
              />
              {fieldErrors.mac_min_length ? <p className="text-xs text-red-600 mt-1">{fieldErrors.mac_min_length}</p> : null}
            </div>
            <div>
              <Label htmlFor="mac-max-length">MAC Maximum Length</Label>
              <Input
                id="mac-max-length"
                type="number"
                min={1}
                value={rulesForm.mac_max_length}
                className="mt-1.5"
                disabled={rulesLoading || rulesSaving || !effectiveOrganisationId}
                onChange={(event) => handleFieldChange("mac_max_length", event.target.value)}
              />
              {fieldErrors.mac_max_length ? <p className="text-xs text-red-600 mt-1">{fieldErrors.mac_max_length}</p> : null}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <Label htmlFor="c-number-min-length">C-Number Minimum Length</Label>
              <Input
                id="c-number-min-length"
                type="number"
                min={1}
                value={rulesForm.c_number_min_length}
                className="mt-1.5"
                disabled={rulesLoading || rulesSaving || !effectiveOrganisationId}
                onChange={(event) => handleFieldChange("c_number_min_length", event.target.value)}
              />
              {fieldErrors.c_number_min_length ? <p className="text-xs text-red-600 mt-1">{fieldErrors.c_number_min_length}</p> : null}
            </div>
            <div>
              <Label htmlFor="c-number-max-length">C-Number Maximum Length</Label>
              <Input
                id="c-number-max-length"
                type="number"
                min={1}
                value={rulesForm.c_number_max_length}
                className="mt-1.5"
                disabled={rulesLoading || rulesSaving || !effectiveOrganisationId}
                onChange={(event) => handleFieldChange("c_number_max_length", event.target.value)}
              />
              {fieldErrors.c_number_max_length ? <p className="text-xs text-red-600 mt-1">{fieldErrors.c_number_max_length}</p> : null}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button type="button" disabled={rulesLoading || rulesSaving || !effectiveOrganisationId} onClick={() => void saveRules()}>
            {rulesSaving ? "Saving..." : "Save Validation Rules"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={rulesLoading || rulesSaving || !effectiveOrganisationId}
            onClick={() => void loadRules(effectiveOrganisationId)}
          >
            {rulesLoading ? "Refreshing..." : "Refresh Rules"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
