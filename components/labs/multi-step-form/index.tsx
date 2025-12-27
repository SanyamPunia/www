"use client";

import { AnimatePresence, motion } from "framer-motion";
import type React from "react";
import { useEffect, useRef, useState } from "react";

interface FormData {
  name: string;
  age: string;
  company: string;
  role: string;
  email: string;
  verified: boolean;
}

const steps = [
  {
    id: 1,
    title: "Personal Information",
    description: "Tell us about yourself",
  },
  {
    id: 2,
    title: "Company Details",
    description: "Where do you work?",
  },
  {
    id: 3,
    title: "Verification",
    description: "Quick summary",
  },
] as const;

function Label({
  children,
  htmlFor,
  className = "",
}: React.PropsWithChildren<{ htmlFor?: string; className?: string }>) {
  return (
    <label
      htmlFor={htmlFor}
      className={`text-xs text-text-secondary ${className}`}
    >
      {children}
    </label>
  );
}

function Input({
  className = "",
  ...props
}: React.ComponentPropsWithoutRef<"input">) {
  return (
    <input
      {...props}
      className={`w-full h-9 px-3 rounded-sm text-sm bg-neutral-900/30 border border-[#1e1e1e] text-text-primary placeholder:text-text-muted outline-none focus:border-[#2a2a2a] transition-colors ${className}`}
    />
  );
}

function Button({
  className = "",
  variant = "default",
  ...props
}: React.ComponentPropsWithoutRef<"button"> & {
  variant?: "default" | "outline";
}) {
  const base =
    "cursor-pointer h-9 px-3 rounded-sm text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";
  const styles =
    variant === "outline"
      ? "border border-[#1e1e1e] bg-transparent text-text-secondary hover:bg-neutral-800/30 hover:text-text-primary"
      : "border border-[#1e1e1e] bg-neutral-900/60 text-text-primary hover:bg-neutral-800/60";

  return <button {...props} className={`${base} ${styles} ${className}`} />;
}

function MultiStepForm() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    age: "",
    company: "",
    role: "",
    email: "",
    verified: false,
  });

  const [height, setHeight] = useState(0);
  const [showBorder, setShowBorder] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      const resizeObserver = new ResizeObserver(() => {
        if (contentRef.current) {
          setHeight(contentRef.current.offsetHeight);
        }
      });
      resizeObserver.observe(contentRef.current);

      // Initial measurement
      setHeight(contentRef.current.offsetHeight);

      return () => resizeObserver.disconnect();
    }
  }, []);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: keyof FormData,
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: e.target.value,
    }));
  };

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = () => {
    setFormData((prev) => ({ ...prev, verified: true }));
  };

  return (
    <div className="flex min-h-48 sm:min-h-64 w-full items-center justify-center border border-[#131313] rounded-sm bg-[#0b0b0b] px-4 py-6 overflow-hidden">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-sm font-semibold text-text-primary">
              {steps[currentStep - 1].title}
            </h1>
            <p className="text-xs text-text-secondary mt-1">
              {steps[currentStep - 1].description}
            </p>
          </div>
          <button
            onClick={() => setShowBorder((prev) => !prev)}
            className="text-xs px-2 py-1 rounded-sm border border-[#1e1e1e] bg-neutral-900/30 text-text-secondary hover:text-text-primary hover:bg-neutral-800/30 transition-colors"
            type="button"
          >
            {showBorder ? "Hide Border" : "Show Border"}
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex gap-2 mb-6">
          {steps.map((step) => (
            <div
              key={step.id}
              className={`h-1 flex-1 rounded-sm transition-colors ${
                currentStep >= step.id ? "bg-emerald-500/60" : "bg-[#1e1e1e]"
              }`}
            />
          ))}
        </div>

        {/* Form Container with Dynamic Height Animation */}
        <motion.div
          ref={containerRef}
          animate={{ height }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className={`mb-6 ${
            showBorder
              ? "border border-[#1e1e1e] rounded-sm p-3 bg-neutral-900/20 overflow-y-scroll"
              : "overflow-hidden"
          }`}
        >
          <div ref={contentRef}>
            <AnimatePresence mode="wait">
              {currentStep === 1 && (
                <motion.div
                  key="step-1"
                  initial={{ opacity: 0, y: 2, filter: "blur(2px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -2, filter: "blur(2px)" }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  <div>
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="John Doe"
                      value={formData.name}
                      onChange={(e) => handleInputChange(e, "name")}
                      className="text-sm border-[#1e1e1e] rounded-sm mt-1"
                      autoComplete="name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="age">Age</Label>
                    <Input
                      id="age"
                      type="number"
                      placeholder="25"
                      value={formData.age}
                      onChange={(e) => handleInputChange(e, "age")}
                      className="text-sm border-[#1e1e1e] rounded-sm mt-1"
                    />
                  </div>
                </motion.div>
              )}

              {currentStep === 2 && (
                <motion.div
                  key="step-2"
                  initial={{ opacity: 0, y: 2, filter: "blur(2px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -2, filter: "blur(2px)" }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  <div>
                    <Label htmlFor="company">Company Name</Label>
                    <Input
                      id="company"
                      type="text"
                      placeholder="Acme Inc"
                      value={formData.company}
                      onChange={(e) => handleInputChange(e, "company")}
                      className="text-sm border-[#1e1e1e] rounded-sm mt-1"
                      autoComplete="organization"
                    />
                  </div>
                  <div>
                    <Label htmlFor="role">Job Title</Label>
                    <Input
                      id="role"
                      type="text"
                      placeholder="Product Manager"
                      value={formData.role}
                      onChange={(e) => handleInputChange(e, "role")}
                      className="text-sm border-[#1e1e1e] rounded-sm mt-1"
                      autoComplete="organization-title"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="john@example.com"
                      value={formData.email}
                      onChange={(e) => handleInputChange(e, "email")}
                      className="text-sm border-[#1e1e1e] rounded-sm mt-1"
                      autoComplete="email"
                    />
                  </div>
                </motion.div>
              )}

              {currentStep === 3 && (
                <motion.div
                  key="step-3"
                  initial={{ opacity: 0, y: 2, filter: "blur(2px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -2, filter: "blur(2px)" }}
                  transition={{ duration: 0.3 }}
                  className="space-y-3 text-sm"
                >
                  <div className="border border-[#1e1e1e] rounded-sm p-3 bg-neutral-900/20">
                    <p className="text-xs text-text-secondary mb-1">Name</p>
                    <p className="text-text-primary font-medium">
                      {formData.name}
                    </p>
                  </div>
                  <div className="border border-[#1e1e1e] rounded-sm p-3 bg-neutral-900/20">
                    <p className="text-xs text-text-secondary mb-1">Age</p>
                    <p className="text-text-primary font-medium">
                      {formData.age}
                    </p>
                  </div>
                  <div className="border border-[#1e1e1e] rounded-sm p-3 bg-neutral-900/20">
                    <p className="text-xs text-text-secondary mb-1">Company</p>
                    <p className="text-text-primary font-medium">
                      {formData.company}
                    </p>
                  </div>
                  <div className="border border-[#1e1e1e] rounded-sm p-3 bg-neutral-900/20">
                    <p className="text-xs text-text-secondary mb-1">Position</p>
                    <p className="text-text-primary font-medium">
                      {formData.role}
                    </p>
                  </div>
                  <div className="border border-[#1e1e1e] rounded-sm p-3 bg-neutral-900/20">
                    <p className="text-xs text-text-secondary mb-1">Email</p>
                    <p className="text-text-primary font-medium">
                      {formData.email}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Navigation Buttons */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={currentStep === 1}
            className="text-sm rounded-sm flex-1 border-[#1e1e1e] bg-transparent"
          >
            Back
          </Button>
          <Button
            onClick={currentStep === steps.length ? handleSubmit : handleNext}
            disabled={currentStep === steps.length}
            className="text-sm rounded-sm flex-1"
          >
            {currentStep === steps.length ? "Submit" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return <MultiStepForm />;
}
