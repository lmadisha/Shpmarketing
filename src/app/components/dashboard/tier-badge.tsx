import { Badge } from "../ui/badge";
import { cn } from "../ui/utils";

export type TierType = "gold" | "silver" | "bronze" | "insufficient";

interface TierBadgeProps {
  tier: TierType;
  className?: string;
}

export function TierBadge({ tier, className }: TierBadgeProps) {
  const config = {
    gold: {
      label: "Gold",
      className: "bg-yellow-100 text-yellow-800 border-yellow-300",
    },
    silver: {
      label: "Silver",
      className: "bg-gray-100 text-gray-800 border-gray-300",
    },
    bronze: {
      label: "Bronze",
      className: "bg-orange-100 text-orange-800 border-orange-300",
    },
    insufficient: {
      label: "Insufficient Data",
      className: "bg-gray-50 text-gray-600 border-gray-200",
    },
  };

  const { label, className: tierClassName } = config[tier];

  return (
    <Badge
      variant="outline"
      className={cn("font-medium", tierClassName, className)}
    >
      {label}
    </Badge>
  );
}
