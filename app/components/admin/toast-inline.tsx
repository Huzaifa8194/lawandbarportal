export default function ToastInline({
  type,
  message,
}: {
  type: "success" | "error";
  message: string;
}) {
  return (
    <p
      className={`rounded-lg px-3 py-2 text-sm ${
        type === "success"
          ? "border border-green-200 bg-green-50 text-green-800"
          : "border border-red-200 bg-red-50 text-red-700"
      }`}
    >
      {message}
    </p>
  );
}
