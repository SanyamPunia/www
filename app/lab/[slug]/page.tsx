"use client";

import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { use } from "react";
import LabContent from "@/components/lab/lab-content";
import LabHeader from "@/components/lab/lab-header";
import LabNotFound from "@/components/lab/lab-not-found";
import LabSkeleton from "@/components/ui/lab-skeleton";
import MaxWidthWrapper from "@/components/ui/max-width-wrapper";
import { getLabBySlug } from "@/lib/labs.registry";

type LabComponent = React.ComponentType<Record<string, never>>;

const dynamicComponents: Record<string, LabComponent> = {
  "cursor-origin-button": dynamic(
    () => import("@/components/labs/cursor-origin-button/index"),
    { ssr: false },
  ),
  "phrase-transition": dynamic(
    () => import("@/components/labs/phrase-transition/index"),
    { ssr: false },
  ),
  "split-to-edit": dynamic(
    () => import("@/components/labs/split-to-edit/index"),
    { ssr: false },
  ),
  "spring-image": dynamic(
    () => import("@/components/labs/spring-image/index"),
    { ssr: false },
  ),
  "discount-code-input": dynamic(
    () => import("@/components/labs/discount-code-input/index"),
    { ssr: false },
  ),
};

interface LabPageProps {
  params: Promise<{ slug: string }>;
}

const page = ({ params }: LabPageProps) => {
  const { slug } = use(params);
  const labMetadata = getLabBySlug(slug);
  const DynamicLab = dynamicComponents[slug];

  if (!DynamicLab) {
    return <LabNotFound />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <MaxWidthWrapper
        size="screen-md"
        className="bg-primary-bg border border-[#121212] rounded-sm overflow-hidden"
        animated={true}
        // showTerminalHeader={true}
      >
        <div className="flex flex-col gap-6 sm:py-20 py-12 sm:px-8 px-0">
          <motion.div
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: {
                transition: { staggerChildren: 0.08, delayChildren: 0.35 },
              },
            }}
          >
            <LabHeader
              title={labMetadata?.title || slug}
              createdAt={labMetadata?.createdAt}
            />
            <LabContent
              description={labMetadata?.description}
              source={labMetadata?.source}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
          >
            {DynamicLab ? <DynamicLab /> : <LabSkeleton />}
          </motion.div>
        </div>
      </MaxWidthWrapper>
    </div>
  );
};

export default page;
