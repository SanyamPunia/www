"use client";

import { AnimatePresence, motion } from "motion/react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { TextMorph } from "torph/react";

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
      className={`text-meta text-text-secondary ${className}`}
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
      /*
       * `text-action`, matching the buttons, not `text-body`. This form is a
       * widget inside the page, so its controls sit a step below the page's
       * prose rather than level with it. At `text-body` the inputs read as
       * large as the paragraph explaining the demo.
       *
       * The placeholder size is spelled out and tracks the input. Browsers
       * render placeholders at their own base size otherwise, which is why a
       * `placeholder:text-*` is required on every control that has one.
       */
      className={`w-full h-9 px-3 rounded-lg text-action bg-bg ring-1 ring-stroke ring-inset text-text-primary placeholder:text-action placeholder:text-text-muted outline-none focus:border-stroke-strong transition-colors ${className}`}
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
    "h-9 cursor-pointer rounded-lg px-3 text-action font-medium ring-1 ring-stroke ring-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 disabled:cursor-not-allowed disabled:opacity-50";
  const styles =
    variant === "outline"
      ? "bg-bg text-text-secondary hover:bg-fill hover:text-text-primary"
      : "bg-fill text-text-primary hover:bg-fill-hover";

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
    <div className="flex min-h-48 sm:min-h-64 w-full items-center justify-center px-4 py-6 overflow-hidden">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            {/*
             * `font-medium`, not `font-semibold`. Nothing on this site is bold,
             * so the step from the description below it is size and tone. Also
             * not an `h1`: the lab page already renders one.
             */}
            <p className="text-body font-medium text-text-primary">
              {steps[currentStep - 1].title}
            </p>
            <p className="text-meta text-text-secondary mt-1">
              {steps[currentStep - 1].description}
            </p>
          </div>
          <button
            onClick={() => setShowBorder((prev) => !prev)}
            className="cursor-pointer rounded-lg bg-bg px-2 py-1 text-meta text-text-secondary ring-1 ring-stroke ring-inset transition-colors hover:bg-fill hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15"
            type="button"
          >
            {/* torph morphs the shared letters instead of swapping the whole
                label, so "show" to "hide" reads as the word changing. It takes
                text children only, never elements. */}
            <TextMorph>{showBorder ? "Hide border" : "Show border"}</TextMorph>
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex gap-2 mb-6">
          {steps.map((step) => (
            <div
              key={step.id}
              className={`h-1 flex-1 rounded-lg transition-colors ${
                currentStep >= step.id ? "bg-text-primary" : "bg-fill"
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
              ? "ring-1 ring-stroke ring-inset rounded-lg p-3 bg-surface overflow-y-scroll [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
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
                      className="border-stroke rounded-lg mt-1"
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
                      className="border-stroke rounded-lg mt-1"
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
                      className="border-stroke rounded-lg mt-1"
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
                      className="border-stroke rounded-lg mt-1"
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
                      className="border-stroke rounded-lg mt-1"
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
                  className="space-y-3 text-action"
                >
                  <div className="ring-1 ring-stroke ring-inset rounded-lg p-3 bg-surface">
                    <p className="text-meta text-text-secondary mb-1">Name</p>
                    <p className="text-text-primary font-medium">
                      {formData.name}
                    </p>
                  </div>
                  <div className="ring-1 ring-stroke ring-inset rounded-lg p-3 bg-surface">
                    <p className="text-meta text-text-secondary mb-1">Age</p>
                    <p className="text-text-primary font-medium">
                      {formData.age}
                    </p>
                  </div>
                  <div className="ring-1 ring-stroke ring-inset rounded-lg p-3 bg-surface">
                    <p className="text-meta text-text-secondary mb-1">
                      Company
                    </p>
                    <p className="text-text-primary font-medium">
                      {formData.company}
                    </p>
                  </div>
                  <div className="ring-1 ring-stroke ring-inset rounded-lg p-3 bg-surface">
                    <p className="text-meta text-text-secondary mb-1">
                      Position
                    </p>
                    <p className="text-text-primary font-medium">
                      {formData.role}
                    </p>
                  </div>
                  <div className="ring-1 ring-stroke ring-inset rounded-lg p-3 bg-surface">
                    <p className="text-meta text-text-secondary mb-1">Email</p>
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
            className="rounded-lg flex-1 border-stroke bg-transparent"
          >
            Back
          </Button>
          <Button
            onClick={currentStep === steps.length ? handleSubmit : handleNext}
            disabled={currentStep === steps.length}
            className="rounded-lg flex-1"
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
