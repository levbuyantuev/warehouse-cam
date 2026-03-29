import { Link } from "wouter";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center border border-stone-200">
        <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-display font-bold text-stone-800 mb-3">Page Not Found</h1>
        <p className="text-stone-500 mb-8">
          The screen you're looking for doesn't exist or has been moved.
        </p>
        <Link href="/" className="inline-block w-full">
          <Button size="xl" className="w-full">Return Home</Button>
        </Link>
      </div>
    </div>
  );
}
