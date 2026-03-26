import { Lock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

type AccessDeniedCardProps = {
  title?: string;
  description?: string;
};

export function AccessDeniedCard({
  title = "Access denied",
  description = "You do not have permission to view this section.",
}: AccessDeniedCardProps) {
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-4 w-4" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Contact an administrator if you need access.
        </p>
      </CardContent>
    </Card>
  );
}
