"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronLeftIcon, ChevronRightIcon, CheckIcon } from "@/components/ui/icons";
import { mobileTypography } from "@/lib/design-tokens";

// ============================================================================
// TYPES
// ============================================================================

export interface FormWizardStep {
  id: string;
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  isOptional?: boolean;
  validate?: () => boolean | Promise<boolean>;
}

export interface FormWizardProps {
  steps: FormWizardStep[];
  currentStep: number;
  onStepChange: (step: number) => void;
  onComplete?: () => void;
  children: React.ReactNode;
  className?: string;
  showStepIndicator?: boolean;
  allowSkip?: boolean;
  completeLabel?: string;
  nextLabel?: string;
  backLabel?: string;
  isSubmitting?: boolean;
}

// ============================================================================
// STEP INDICATOR COMPONENT
// ============================================================================

interface StepIndicatorProps {
  steps: FormWizardStep[];
  currentStep: number;
  onStepClick?: (step: number) => void;
  clickable?: boolean;
}

function StepIndicator({ steps, currentStep, onStepClick, clickable = false }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2 py-4">
      {steps.map((step, index) => {
        const isActive = index === currentStep;
        const isCompleted = index < currentStep;
        const canClick = clickable && (isCompleted || index === currentStep + 1);

        return (
          <React.Fragment key={step.id}>
            <button
              type="button"
              onClick={() => canClick && onStepClick?.(index)}
              disabled={!canClick}
              className={cn(
                "relative flex items-center justify-center transition-all duration-200",
                canClick && "cursor-pointer",
                !canClick && "cursor-default"
              )}
            >
              <motion.div
                initial={false}
                animate={{
                  scale: isActive ? 1.1 : 1,
                  backgroundColor: isCompleted || isActive
                    ? "hsl(var(--primary))"
                    : "hsl(var(--muted))",
                }}
                className={cn(
                  "size-8 rounded-full flex items-center justify-center text-xs font-medium",
                  (isCompleted || isActive) && "text-primary-foreground",
                  !isCompleted && !isActive && "text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <CheckIcon className="size-4" />
                ) : (
                  index + 1
                )}
              </motion.div>
              {isActive && (
                <motion.div
                  layoutId="activeStep"
                  className="absolute inset-0 rounded-full ring-2 ring-primary ring-offset-2 ring-offset-background"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
            {index < steps.length - 1 && (
              <motion.div
                initial={false}
                animate={{
                  backgroundColor: index < currentStep
                    ? "hsl(var(--primary))"
                    : "hsl(var(--muted))",
                }}
                className="h-0.5 w-8 rounded-full"
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ============================================================================
// STEP HEADER COMPONENT
// ============================================================================

interface StepHeaderProps {
  step: FormWizardStep;
  stepNumber: number;
  totalSteps: number;
}

function StepHeader({ step, stepNumber, totalSteps }: StepHeaderProps) {
  return (
    <div className="px-4 pb-4 border-b">
      <div className="flex items-center gap-3">
        {step.icon && (
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
            <step.icon className="size-5 text-primary" />
          </div>
        )}
        <div className="flex-1">
          <p className="text-xs text-muted-foreground mb-0.5">
            Step {stepNumber} of {totalSteps}
            {step.isOptional && " (Optional)"}
          </p>
          <h2 className={cn(mobileTypography.sectionTitle)}>{step.title}</h2>
          {step.description && (
            <p className={cn(mobileTypography.cardMeta, "mt-0.5")}>
              {step.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function FormWizard({
  steps,
  currentStep,
  onStepChange,
  onComplete,
  children,
  className,
  showStepIndicator = true,
  allowSkip = false,
  completeLabel = "Complete",
  nextLabel = "Next",
  backLabel = "Back",
  isSubmitting = false,
}: FormWizardProps) {
  const [direction, setDirection] = React.useState(0);
  const currentStepData = steps[currentStep];

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  // Handle next step
  const handleNext = React.useCallback(async () => {
    const step = steps[currentStep];

    // Validate current step if validation function exists
    if (step?.validate) {
      const isValid = await step.validate();
      if (!isValid) return;
    }

    if (isLastStep) {
      onComplete?.();
    } else {
      setDirection(1);
      onStepChange(currentStep + 1);
    }
  }, [currentStep, steps, isLastStep, onComplete, onStepChange]);

  // Handle back step
  const handleBack = React.useCallback(() => {
    if (!isFirstStep) {
      setDirection(-1);
      onStepChange(currentStep - 1);
    }
  }, [currentStep, isFirstStep, onStepChange]);

  // Handle step click from indicator
  const handleStepClick = React.useCallback(
    (step: number) => {
      setDirection(step > currentStep ? 1 : -1);
      onStepChange(step);
    },
    [currentStep, onStepChange]
  );

  // Animation variants
  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 100 : -100,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 100 : -100,
      opacity: 0,
    }),
  };

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      {/* Step Indicator */}
      {showStepIndicator && (
        <div className="flex-none safe-top border-b bg-card">
          <StepIndicator
            steps={steps}
            currentStep={currentStep}
            onStepClick={handleStepClick}
            clickable={allowSkip}
          />
        </div>
      )}

      {/* Step Header */}
      {currentStepData && (
        <div className="flex-none bg-card">
          <StepHeader
            step={currentStepData}
            stepNumber={currentStep + 1}
            totalSteps={steps.length}
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={currentStep}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 },
            }}
            className="absolute inset-0 overflow-y-auto"
          >
            <div className="p-4">{children}</div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex-none border-t bg-card px-4 py-3 safe-bottom">
        <div className="flex gap-3">
          {!isFirstStep && (
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={isSubmitting}
              className="flex-1 h-12"
            >
              <ChevronLeftIcon className="size-4 mr-1" />
              {backLabel}
            </Button>
          )}
          <Button
            type="button"
            onClick={handleNext}
            disabled={isSubmitting}
            className={cn("h-12", isFirstStep ? "w-full" : "flex-1")}
          >
            {isSubmitting ? (
              <div className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : isLastStep ? (
              <>
                <CheckIcon className="size-4 mr-1" />
                {completeLabel}
              </>
            ) : (
              <>
                {nextLabel}
                <ChevronRightIcon className="size-4 ml-1" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// CONTEXT FOR FORM WIZARD
// ============================================================================

interface FormWizardContextValue {
  currentStep: number;
  totalSteps: number;
  goToStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
}

const FormWizardContext = React.createContext<FormWizardContextValue | null>(null);

export function useFormWizard() {
  const context = React.useContext(FormWizardContext);
  if (!context) {
    throw new Error("useFormWizard must be used within a FormWizardProvider");
  }
  return context;
}

export function FormWizardProvider({
  children,
  totalSteps,
  initialStep = 0,
  onStepChange,
}: {
  children: React.ReactNode;
  totalSteps: number;
  initialStep?: number;
  onStepChange?: (step: number) => void;
}) {
  const [currentStep, setCurrentStep] = React.useState(initialStep);

  const goToStep = React.useCallback(
    (step: number) => {
      if (step >= 0 && step < totalSteps) {
        setCurrentStep(step);
        onStepChange?.(step);
      }
    },
    [totalSteps, onStepChange]
  );

  const nextStep = React.useCallback(() => {
    goToStep(currentStep + 1);
  }, [currentStep, goToStep]);

  const prevStep = React.useCallback(() => {
    goToStep(currentStep - 1);
  }, [currentStep, goToStep]);

  const value: FormWizardContextValue = {
    currentStep,
    totalSteps,
    goToStep,
    nextStep,
    prevStep,
    isFirstStep: currentStep === 0,
    isLastStep: currentStep === totalSteps - 1,
  };

  return (
    <FormWizardContext.Provider value={value}>
      {children}
    </FormWizardContext.Provider>
  );
}

export default FormWizard;
