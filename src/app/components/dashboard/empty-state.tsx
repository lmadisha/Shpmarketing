import { AlertCircle, Database, FileX } from "lucide-react";
import { cn } from "../ui/utils";
import { Button } from "../ui/button";

interface EmptyStateProps {
  type?: "no-data" | "error" | "insufficient";
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  type = "no-data",
  title,
  message,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  const config = {
    "no-data": {
      icon: Database,
      defaultTitle: "No data available",
      defaultMessage: "Try adjusting your filters or check back later.",
      iconColor: "text-gray-400",
    },
    "error": {
      icon: AlertCircle,
      defaultTitle: "Something went wrong",
      defaultMessage: "We couldn't load the data. Please try again.",
      iconColor: "text-red-400",
    },
    "insufficient": {
      icon: FileX,
      defaultTitle: "Insufficient data",
      defaultMessage: "Not enough data to display this information.",
      iconColor: "text-orange-400",
    },
  };

  const { icon: Icon, defaultTitle, defaultMessage, iconColor } = config[type];

  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-12 px-6 text-center bg-white rounded-lg border border-gray-200",
      className
    )}>
      <Icon className={cn("w-12 h-12 mb-4", iconColor)} />
      <h3 className="text-lg font-medium text-gray-900 mb-2">
        {title || defaultTitle}
      </h3>
      <p className="text-sm text-gray-600 max-w-sm mb-6">
        {message || defaultMessage}
      </p>
      {actionLabel && onAction && (
        <Button onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
