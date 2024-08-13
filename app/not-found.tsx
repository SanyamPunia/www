import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex items-center justify-center h-screen lowercase">
      <div className="flex flex-col justify-center items-center">
        <h1 className="text-center font-medium text-2xl mb-8">
          This page doesn't exists. <br />
          Please try a different route.
        </h1>

        <Link href="/" className="cursor-pointer">
          <div className="underline underline-offset-4 lowercase">/Home</div>
        </Link>
      </div>
    </div>
  );
}
