type Status = "active" | "due" | "inactive" | "crosschain";

const styles: Record<Status, string> = {
  active: "bg-green-900/50 text-green-400 border-green-800",
  due: "bg-yellow-900/50 text-yellow-400 border-yellow-800",
  inactive: "bg-gray-800/50 text-gray-500 border-gray-700",
  crosschain: "bg-purple-900/50 text-purple-400 border-purple-800",
};

const labels: Record<Status, string> = {
  active: "Active",
  due: "Due",
  inactive: "Inactive",
  crosschain: "Cross-Chain",
};

interface StatusBadgeProps {
  status: Status;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
