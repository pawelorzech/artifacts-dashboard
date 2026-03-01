import Link from "next/link";
import { MapPinOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex items-center justify-center h-full p-6">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center space-y-4">
          <MapPinOff className="size-12 text-muted-foreground mx-auto" />
          <div>
            <h2 className="text-lg font-semibold">Page not found</h2>
            <p className="text-sm text-muted-foreground mt-1">
              The page you&apos;re looking for doesn&apos;t exist.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
