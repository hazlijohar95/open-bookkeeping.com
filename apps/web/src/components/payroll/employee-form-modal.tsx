/**
 * Employee Form Modal
 * Create and edit employee records with comprehensive form fields
 */

import { useCallback, useMemo } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogContentContainer,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogHeaderContainer,
  DialogIcon,
  DialogTitle,
} from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/utils";
import { z } from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCreateEmployee, useUpdateEmployee, type Employee } from "@/api/payroll";
import { toast } from "sonner";
import { User } from "@/components/ui/icons";
import { ScrollArea } from "@/components/ui/scroll-area";

/**
 * Parse Malaysian IC number to extract date of birth
 * IC Format: YYMMDD-SS-NNNN or YYMMDDSSNNNN
 * - YYMMDD: Date of birth
 * - SS: State code (01-16, 21-22, 74-82, 83 for foreigners)
 * - NNNN: Serial number (last digit odd=male, even=female)
 */
function parseICNumber(ic: string): { dob: string | null; gender: "male" | "female" | null; stateCode: string | null; error: string | null } {
  // Remove dashes and spaces
  const cleaned = ic.replace(/[-\s]/g, "");

  // Check length (12 digits)
  if (cleaned.length !== 12) {
    return { dob: null, gender: null, stateCode: null, error: cleaned.length > 0 ? "IC must be 12 digits" : null };
  }

  // Check if all digits
  if (!/^\d{12}$/.test(cleaned)) {
    return { dob: null, gender: null, stateCode: null, error: "IC must contain only numbers" };
  }

  // Extract parts
  const year = cleaned.substring(0, 2);
  const month = cleaned.substring(2, 4);
  const day = cleaned.substring(4, 6);
  const stateCode = cleaned.substring(6, 8);
  const lastDigit = parseInt(cleaned.substring(11, 12), 10);

  // Determine century (00-30 = 2000s, 31-99 = 1900s)
  const yearNum = parseInt(year, 10);
  const fullYear = yearNum <= 30 ? 2000 + yearNum : 1900 + yearNum;

  // Validate month (01-12)
  const monthNum = parseInt(month, 10);
  if (monthNum < 1 || monthNum > 12) {
    return { dob: null, gender: null, stateCode, error: "Invalid month in IC" };
  }

  // Validate day (01-31, approximate)
  const dayNum = parseInt(day, 10);
  if (dayNum < 1 || dayNum > 31) {
    return { dob: null, gender: null, stateCode, error: "Invalid day in IC" };
  }

  // Create date and validate it's real
  const dateStr = `${fullYear}-${month}-${day}`;
  const date = new Date(dateStr);
  if (isNaN(date.getTime()) || date.getDate() !== dayNum) {
    return { dob: null, gender: null, stateCode, error: "Invalid date in IC" };
  }

  // Check date is not in future
  if (date > new Date()) {
    return { dob: null, gender: null, stateCode, error: "Birth date cannot be in future" };
  }

  // Determine gender from last digit
  const gender = lastDigit % 2 === 0 ? "female" as const : "male" as const;

  return { dob: dateStr, gender, stateCode, error: null };
}

/**
 * Malaysian state codes mapping
 */
const MALAYSIAN_STATE_CODES: Record<string, string> = {
  "01": "Johor",
  "02": "Kedah",
  "03": "Kelantan",
  "04": "Melaka",
  "05": "Negeri Sembilan",
  "06": "Pahang",
  "07": "Pulau Pinang",
  "08": "Perak",
  "09": "Perlis",
  "10": "Selangor",
  "11": "Terengganu",
  "12": "Sabah",
  "13": "Sarawak",
  "14": "WP Kuala Lumpur",
  "15": "WP Labuan",
  "16": "WP Putrajaya",
  "21": "Johor",
  "22": "Johor",
  "74": "Sabah",
  "75": "Sabah",
  "76": "Sabah",
  "77": "Sabah",
  "78": "Sarawak",
  "79": "Sarawak",
  "80": "Sarawak",
  "81": "Sarawak",
  "82": "Unknown State",
  "83": "Foreign Born",
};

/**
 * IC Number field with auto-parse and DOB auto-fill
 */
interface ICNumberFieldProps {
   
  form: any;
}

function ICNumberField({ form }: ICNumberFieldProps) {
  const icValue = form.watch("icNumber") || "";

  // Parse IC number for validation and info display
  const icInfo = useMemo(() => parseICNumber(icValue), [icValue]);

  // Handle IC number change with auto-fill
  const handleICChange = useCallback((value: string, onChange: (v: string) => void) => {
    // Format with dashes as user types (XXXXXX-XX-XXXX)
    let formatted = value.replace(/[^0-9]/g, "");
    if (formatted.length > 6) {
      formatted = formatted.slice(0, 6) + "-" + formatted.slice(6);
    }
    if (formatted.length > 9) {
      formatted = formatted.slice(0, 9) + "-" + formatted.slice(9);
    }
    formatted = formatted.slice(0, 14); // Max length with dashes

    onChange(formatted);

    // Parse and auto-fill DOB if valid
    const parsed = parseICNumber(formatted);
    if (parsed.dob && !parsed.error) {
      const currentDob = form.getValues("dateOfBirth");
      // Only auto-fill if DOB is empty or was previously auto-filled
      if (!currentDob || currentDob === "" || parseICNumber(form.getValues("icNumber") || "").dob === currentDob) {
        form.setValue("dateOfBirth", parsed.dob, { shouldValidate: true });
      }
    }
  }, [form]);

  return (
    <FormField
      control={form.control}
      name="icNumber"
      render={({ field }) => (
        <FormItem>
          <FormLabel>IC Number</FormLabel>
          <FormControl>
            <Input
              placeholder="XXXXXX-XX-XXXX"
              {...field}
              onChange={(e) => handleICChange(e.target.value, field.onChange)}
            />
          </FormControl>
          {icInfo.error ? (
            <FormDescription className="text-destructive text-xs">
              {icInfo.error}
            </FormDescription>
          ) : icInfo.dob ? (
            <FormDescription className="text-green-600 dark:text-green-400 text-xs">
              Valid IC: Born {new Date(icInfo.dob).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}
              {icInfo.stateCode && MALAYSIAN_STATE_CODES[icInfo.stateCode] && ` (${MALAYSIAN_STATE_CODES[icInfo.stateCode]})`}
            </FormDescription>
          ) : (
            <FormDescription className="text-muted-foreground text-xs">
              Format: XXXXXX-XX-XXXX (DOB will auto-fill)
            </FormDescription>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

// Base form schema (shared fields)
const baseEmployeeSchema = z.object({
  // Basic Info
  employeeCode: z.string().min(1, "Employee code is required").max(20),
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().max(100).optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().max(20).optional(),
  address: z.string().max(500).optional(),

  // Employment
  status: z.enum(["active", "probation", "terminated", "resigned", "retired"]).default("active"),
  employmentType: z.enum(["full_time", "part_time", "contract", "intern"]).default("full_time"),
  dateJoined: z.string().min(1, "Date joined is required"),
  department: z.string().max(100).optional(),
  position: z.string().max(100).optional(),

  // Personal
  nationality: z.enum(["malaysian", "permanent_resident", "foreign"]).default("malaysian"),
  icNumber: z.string().max(20).optional(),
  passportNumber: z.string().max(50).optional(),
  dateOfBirth: z.string().optional(),

  // Tax Info
  maritalStatus: z.enum(["single", "married", "divorced", "widowed"]).optional(),
  spouseWorking: z.boolean().default(true),
  numberOfChildren: z.coerce.number().min(0).default(0),
  childrenInUniversity: z.coerce.number().min(0).default(0),
  disabledChildren: z.coerce.number().min(0).default(0),
  taxNumber: z.string().max(50).optional(),

  // Statutory
  epfNumber: z.string().max(20).optional(),
  socsoNumber: z.string().max(20).optional(),
  eisNumber: z.string().max(20).optional(),
  epfEmployeeRate: z.string().optional(),
  epfEmployerRate: z.string().optional(),

  // Bank
  bankName: z.string().max(100).optional(),
  bankAccountNumber: z.string().max(50).optional(),
  bankAccountHolder: z.string().max(200).optional(),

  // Salary fields
  baseSalary: z.string().optional(),
  payFrequency: z.enum(["monthly", "bi_weekly", "weekly"]).default("monthly"),
});

// Schema for creating new employees (baseSalary required)
const createEmployeeSchema = baseEmployeeSchema.extend({
  baseSalary: z.string()
    .min(1, "Base salary is required for new employees")
    .refine(
      (val) => /^\d+(\.\d{1,2})?$/.test(val),
      "Invalid salary format (e.g., 5000 or 5000.00)"
    )
    .refine(
      (val) => parseFloat(val) >= 1500,
      "Base salary must be at least RM 1,500 (minimum wage)"
    ),
});

// Schema for editing existing employees (baseSalary optional since it's managed separately)
const updateEmployeeSchema = baseEmployeeSchema;

// Union type for form data
type EmployeeFormData = z.infer<typeof baseEmployeeSchema>;

interface EmployeeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee?: Employee | null;
}

function EmployeeFormContent({ employee, onClose }: EmployeeFormModalProps) {
  const isEditing = !!employee;

  // Use appropriate schema based on create vs edit
  const formSchema = isEditing ? updateEmployeeSchema : createEmployeeSchema;

  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: employee
      ? {
          employeeCode: employee.employeeCode,
          firstName: employee.firstName,
          lastName: employee.lastName ?? "",
          email: employee.email ?? "",
          phone: employee.phone ?? "",
          address: employee.address ?? "",
          status: employee.status,
          employmentType: employee.employmentType,
          dateJoined: employee.dateJoined,
          department: employee.department ?? "",
          position: employee.position ?? "",
          nationality: employee.nationality,
          icNumber: employee.icNumber ?? "",
          passportNumber: employee.passportNumber ?? "",
          dateOfBirth: employee.dateOfBirth ?? "",
          maritalStatus: employee.maritalStatus ?? undefined,
          spouseWorking: employee.spouseWorking ?? true,
          numberOfChildren: employee.numberOfChildren ?? 0,
          childrenInUniversity: employee.childrenInUniversity ?? 0,
          disabledChildren: employee.disabledChildren ?? 0,
          taxNumber: employee.taxNumber ?? "",
          epfNumber: employee.epfNumber ?? "",
          socsoNumber: employee.socsoNumber ?? "",
          eisNumber: employee.eisNumber ?? "",
          epfEmployeeRate: employee.epfEmployeeRate ?? "",
          epfEmployerRate: employee.epfEmployerRate ?? "",
          bankName: employee.bankName ?? "",
          bankAccountNumber: employee.bankAccountNumber ?? "",
          bankAccountHolder: employee.bankAccountHolder ?? "",
        }
      : {
          employeeCode: "",
          firstName: "",
          lastName: "",
          email: "",
          phone: "",
          address: "",
          status: "active",
          employmentType: "full_time",
          dateJoined: new Date().toISOString().split("T")[0],
          department: "",
          position: "",
          nationality: "malaysian",
          icNumber: "",
          passportNumber: "",
          dateOfBirth: "",
          maritalStatus: undefined,
          spouseWorking: true,
          numberOfChildren: 0,
          childrenInUniversity: 0,
          disabledChildren: 0,
          taxNumber: "",
          epfNumber: "",
          socsoNumber: "",
          eisNumber: "",
          epfEmployeeRate: "",
          epfEmployerRate: "",
          bankName: "",
          bankAccountNumber: "",
          bankAccountHolder: "",
          baseSalary: "",
          payFrequency: "monthly",
        },
  });

  const createMutation = useCreateEmployee();
  const updateMutation = useUpdateEmployee();

  // Track which tabs have errors
  const errors = form.formState.errors;
  const basicErrors = errors.employeeCode || errors.firstName || errors.lastName || errors.email || errors.phone || errors.address || errors.status;
  const employmentErrors = errors.employmentType || errors.dateJoined || errors.department || errors.position || errors.baseSalary || errors.payFrequency;
  const personalErrors = errors.nationality || errors.icNumber || errors.passportNumber || errors.dateOfBirth || errors.maritalStatus || errors.spouseWorking || errors.numberOfChildren || errors.childrenInUniversity || errors.disabledChildren || errors.taxNumber;
  const statutoryErrors = errors.epfNumber || errors.socsoNumber || errors.eisNumber || errors.epfEmployeeRate || errors.epfEmployerRate;
  const bankErrors = errors.bankName || errors.bankAccountNumber || errors.bankAccountHolder;

  const handleClose = () => {
    form.reset();
    onClose();
  };

  const onSubmit = (data: EmployeeFormData) => {
    if (isEditing && employee) {
      updateMutation.mutate(
        {
          id: employee.id,
          employeeCode: data.employeeCode,
          firstName: data.firstName,
          lastName: data.lastName || null,
          email: data.email || null,
          phone: data.phone || null,
          address: data.address || null,
          status: data.status,
          employmentType: data.employmentType,
          dateJoined: data.dateJoined,
          department: data.department || null,
          position: data.position || null,
          nationality: data.nationality,
          icNumber: data.icNumber || null,
          passportNumber: data.passportNumber || null,
          dateOfBirth: data.dateOfBirth || null,
          maritalStatus: data.maritalStatus || null,
          spouseWorking: data.spouseWorking,
          numberOfChildren: data.numberOfChildren,
          childrenInUniversity: data.childrenInUniversity,
          disabledChildren: data.disabledChildren,
          taxNumber: data.taxNumber || null,
          epfNumber: data.epfNumber || null,
          socsoNumber: data.socsoNumber || null,
          eisNumber: data.eisNumber || null,
          epfEmployeeRate: data.epfEmployeeRate || null,
          epfEmployerRate: data.epfEmployerRate || null,
          bankName: data.bankName || null,
          bankAccountNumber: data.bankAccountNumber || null,
          bankAccountHolder: data.bankAccountHolder || null,
        },
        {
          onSuccess: () => {
            toast.success("Employee updated successfully");
            handleClose();
          },
          onError: (error) => {
            toast.error(error.message);
          },
        }
      );
    } else {
      // baseSalary is validated by the schema - guaranteed to be valid here
      createMutation.mutate(
        {
          employeeCode: data.employeeCode,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email || undefined,
          phone: data.phone,
          address: data.address,
          status: data.status,
          employmentType: data.employmentType,
          dateJoined: data.dateJoined,
          department: data.department,
          position: data.position,
          nationality: data.nationality,
          icNumber: data.icNumber,
          passportNumber: data.passportNumber,
          dateOfBirth: data.dateOfBirth,
          maritalStatus: data.maritalStatus,
          spouseWorking: data.spouseWorking,
          numberOfChildren: data.numberOfChildren,
          childrenInUniversity: data.childrenInUniversity,
          disabledChildren: data.disabledChildren,
          taxNumber: data.taxNumber,
          epfNumber: data.epfNumber,
          socsoNumber: data.socsoNumber,
          eisNumber: data.eisNumber,
          epfEmployeeRate: data.epfEmployeeRate,
          epfEmployerRate: data.epfEmployerRate,
          bankName: data.bankName,
          bankAccountNumber: data.bankAccountNumber,
          bankAccountHolder: data.bankAccountHolder,
          baseSalary: data.baseSalary!, // Guaranteed by createEmployeeSchema validation
          payFrequency: data.payFrequency,
        },
        {
          onSuccess: () => {
            toast.success("Employee created successfully");
            handleClose();
          },
          onError: (error) => {
            toast.error(error.message);
          },
        }
      );
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <DialogContentContainer>
      <DialogHeaderContainer>
        <DialogIcon>
          <User className="size-5" />
        </DialogIcon>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Employee" : "Add Employee"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update employee information"
              : "Enter employee details to add them to payroll"}
          </DialogDescription>
        </DialogHeader>
      </DialogHeaderContainer>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit, (formErrors) => {
          // Provide specific feedback about which tabs have errors
          const tabsWithErrors: string[] = [];
          if (formErrors.employeeCode || formErrors.firstName || formErrors.lastName || formErrors.email || formErrors.phone || formErrors.address || formErrors.status) {
            tabsWithErrors.push("Basic");
          }
          if (formErrors.employmentType || formErrors.dateJoined || formErrors.department || formErrors.position || formErrors.baseSalary || formErrors.payFrequency) {
            tabsWithErrors.push("Employment");
          }
          if (formErrors.nationality || formErrors.icNumber || formErrors.passportNumber || formErrors.dateOfBirth || formErrors.maritalStatus || formErrors.spouseWorking || formErrors.numberOfChildren || formErrors.childrenInUniversity || formErrors.disabledChildren || formErrors.taxNumber) {
            tabsWithErrors.push("Personal");
          }
          if (formErrors.epfNumber || formErrors.socsoNumber || formErrors.eisNumber || formErrors.epfEmployeeRate || formErrors.epfEmployerRate) {
            tabsWithErrors.push("Statutory");
          }
          if (formErrors.bankName || formErrors.bankAccountNumber || formErrors.bankAccountHolder) {
            tabsWithErrors.push("Bank");
          }

          const errorMessage = tabsWithErrors.length > 0
            ? `Please fix errors in: ${tabsWithErrors.join(", ")}`
            : "Please fix the errors in the form before submitting";
          toast.error(errorMessage);
        })} className="space-y-4">
          <ScrollArea className="h-[500px] pr-4">
            <Tabs defaultValue="basic" className="w-full">
              {/* Horizontal scrollable tabs on mobile */}
              <div className="overflow-x-auto -mx-1 px-1 pb-2">
                <TabsList className="inline-flex w-auto min-w-full sm:grid sm:w-full sm:grid-cols-5 gap-1">
                  <TabsTrigger value="basic" className={basicErrors ? "text-red-600 dark:text-red-400" : ""}>
                    Basic {basicErrors && "•"}
                  </TabsTrigger>
                  <TabsTrigger value="employment" className={employmentErrors ? "text-red-600 dark:text-red-400" : ""}>
                    <span className="hidden sm:inline">Employment</span>
                    <span className="sm:hidden">Employ</span>
                    {employmentErrors && " •"}
                  </TabsTrigger>
                  <TabsTrigger value="personal" className={personalErrors ? "text-red-600 dark:text-red-400" : ""}>
                    Personal {personalErrors && "•"}
                  </TabsTrigger>
                  <TabsTrigger value="statutory" className={statutoryErrors ? "text-red-600 dark:text-red-400" : ""}>
                    <span className="hidden sm:inline">Statutory</span>
                    <span className="sm:hidden">Stat</span>
                    {statutoryErrors && " •"}
                  </TabsTrigger>
                  <TabsTrigger value="bank" className={bankErrors ? "text-red-600 dark:text-red-400" : ""}>
                    Bank {bankErrors && "•"}
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="basic" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="employeeCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employee Code *</FormLabel>
                        <FormControl>
                          <Input placeholder="EMP001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="probation">Probation</SelectItem>
                            <SelectItem value="terminated">Terminated</SelectItem>
                            <SelectItem value="resigned">Resigned</SelectItem>
                            <SelectItem value="retired">Retired</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="John" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="john@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="+60 12-345 6789" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Full address" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="employment" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="employmentType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employment Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="full_time">Full Time</SelectItem>
                            <SelectItem value="part_time">Part Time</SelectItem>
                            <SelectItem value="contract">Contract</SelectItem>
                            <SelectItem value="intern">Intern</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dateJoined"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date Joined *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="department"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Department</FormLabel>
                        <FormControl>
                          <Input placeholder="Engineering" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="position"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Position</FormLabel>
                        <FormControl>
                          <Input placeholder="Software Engineer" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {!isEditing && (
                  <div className="space-y-4 pt-4 border-t">
                    <h4 className="font-medium">Initial Salary</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="baseSalary"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Base Salary (MYR) *</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" placeholder="5000.00" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="payFrequency"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Pay Frequency</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select frequency" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="monthly">Monthly</SelectItem>
                                <SelectItem value="bi_weekly">Bi-weekly</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="personal" className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="nationality"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nationality</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select nationality" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="malaysian">Malaysian</SelectItem>
                          <SelectItem value="permanent_resident">Permanent Resident</SelectItem>
                          <SelectItem value="foreign">Foreign</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <ICNumberField form={form} />

                <FormField
                  control={form.control}
                  name="passportNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Passport Number</FormLabel>
                      <FormControl>
                        <Input placeholder="A12345678" {...field} />
                      </FormControl>
                      <FormDescription className="text-muted-foreground text-xs">
                        Required for foreign employees
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Birth</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormDescription className="text-amber-600 dark:text-amber-400 text-xs">
                        Required for accurate EPF, SOCSO & EIS calculations (age-based rates).
                        {form.watch("icNumber") && parseICNumber(form.watch("icNumber") || "").dob && " Auto-filled from IC."}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4 pt-4 border-t">
                  <h4 className="font-medium">Tax Relief Information</h4>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="maritalStatus"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Marital Status</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="single">Single</SelectItem>
                              <SelectItem value="married">Married</SelectItem>
                              <SelectItem value="divorced">Divorced</SelectItem>
                              <SelectItem value="widowed">Widowed</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="spouseWorking"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel>Spouse Working</FormLabel>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="numberOfChildren"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Children</FormLabel>
                          <FormControl>
                            <Input type="number" min="0" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="childrenInUniversity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>In University</FormLabel>
                          <FormControl>
                            <Input type="number" min="0" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="disabledChildren"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Disabled</FormLabel>
                          <FormControl>
                            <Input type="number" min="0" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="taxNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tax Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Tax reference number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent value="statutory" className="space-y-4 mt-4">
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="epfNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>EPF Number</FormLabel>
                        <FormControl>
                          <Input placeholder="EPF reference" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="socsoNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SOCSO Number</FormLabel>
                        <FormControl>
                          <Input placeholder="SOCSO reference" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="eisNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>EIS Number</FormLabel>
                        <FormControl>
                          <Input placeholder="EIS reference" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <h4 className="font-medium">Custom EPF Rates (Optional)</h4>
                  <p className="text-sm text-muted-foreground">
                    Leave blank to use standard rates based on nationality and age
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="epfEmployeeRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Employee Rate (%)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="11" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="epfEmployerRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Employer Rate (%)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="13" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="bank" className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="bankName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bank Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Maybank" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bankAccountNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Number</FormLabel>
                      <FormControl>
                        <Input placeholder="1234567890" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bankAccountHolder"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Holder Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Account holder name as per bank" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>
            </Tabs>
          </ScrollArea>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isLoading}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : isEditing ? "Update Employee" : "Add Employee"}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContentContainer>
  );
}

export function EmployeeFormModal({ isOpen, onClose, employee }: EmployeeFormModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <EmployeeFormContent
          key={employee?.id ?? "new"}
          isOpen={isOpen}
          onClose={onClose}
          employee={employee}
        />
      </DialogContent>
    </Dialog>
  );
}
