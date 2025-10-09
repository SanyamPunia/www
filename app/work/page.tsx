"use client";

import { motion } from "framer-motion";
import BackButton from "@/components/ui/back-button";
import MaxWidthWrapper from "@/components/ui/max-width-wrapper";
import Companies from "@/components/work/companies";
import Projects from "@/components/work/projects";

const page = () => {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <MaxWidthWrapper
        size="screen-md"
        className="bg-primary-bg border border-[#121212] rounded-sm overflow-hidden max-h-[90vh] flex flex-col"
        // showTerminalHeader={true}
        animated={true}
      >
        <div className="flex-1 overflow-y-auto sm:px-6 px-0 py-6">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="mb-10"
          >
            <BackButton href="/">back to home</BackButton>
          </motion.div>

          <Companies />
          <Projects />
        </div>
      </MaxWidthWrapper>
    </main>
  );
};

export default page;
