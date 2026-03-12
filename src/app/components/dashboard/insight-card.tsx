import { Card, CardContent } from "../ui/card";
import { Lightbulb, TrendingUp, AlertTriangle, Info } from "lucide-react";
import { cn } from "../ui/utils";

type InsightType = "positive" | "warning" | "info" | "neutral";

interface InsightCardProps {
  type?: InsightType;
  title: string;
  description: string;
  className?: string;
}

export function InsightCard({
  type = "neutral",
  title,
  description,
  className,
}: InsightCardProps) {
  const config = {
    positive: {
      icon: TrendingUp,
      bgColor: "bg-green-50",
      iconColor: "text-green-600",
      borderColor: "border-green-200",
    },
    warning: {
      icon: AlertTriangle,
      bgColor: "bg-yellow-50",
      iconColor: "text-yellow-600",
      borderColor: "border-yellow-200",
    },
    info: {
      icon: Info,
      bgColor: "bg-blue-50",
      iconColor: "text-blue-600",
      borderColor: "border-blue-200",
    },
    neutral: {
      icon: Lightbulb,
      bgColor: "bg-gray-50",
      iconColor: "text-gray-600",
      borderColor: "border-gray-200",
    },
  };

  const { icon: Icon, bgColor, iconColor, borderColor } = config[type];

  return (
    <Card className={cn("border", borderColor, className)}>
      <CardContent className="p-4">
        <div className="flex gap-3">
          <div className={cn("p-2 rounded-lg h-fit", bgColor)}>
            <Icon className={cn("w-5 h-5", iconColor)} />
          </div>
          <div className="flex-1">
            <h4 className="font-medium text-gray-900 mb-1">{title}</h4>
            <p className="text-sm text-gray-600">{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
