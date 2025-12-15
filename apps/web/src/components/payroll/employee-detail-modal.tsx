/**
 * Employee Detail Modal
 * View employee details and salary history
 */

import {
  Dialog,
  DialogContent,
  DialogContentContainer,
  DialogDescription,
  DialogHeader,
  DialogHeaderContainer,
  DialogIcon,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Employee, EmployeeStatus } from "@/api/payroll";
import { useSalaryHistory } from "@/api/payroll";
import { User } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/skeleton";

const statusColors: Record<EmployeeStatus, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  probation: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  terminated: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  resigned: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  retired: "bg-slate-100 text-slate-700 dark:bg-slate-800/40 dark:text-slate-300",
};

interface EmployeeDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-2 border-b last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value || "-"}</span>
    </div>
  );
}

export function EmployeeDetailModal({ isOpen, onClose, employee }: EmployeeDetailModalProps) {
  const { data: salaryHistory, isLoading: isSalaryLoading } = useSalaryHistory(employee?.id ?? "");

  if (!employee) return null;

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-MY", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatCurrency = (amount: string | null) => {
    if (!amount) return "-";
    return new Intl.NumberFormat("en-MY", {
      style: "currency",
      currency: "MYR",
    }).format(parseFloat(amount));
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogContentContainer>
          <DialogHeaderContainer>
            <DialogIcon>
              <User className="size-5" />
            </DialogIcon>
            <DialogHeader>
              <DialogTitle>
                {employee.firstName} {employee.lastName}
              </DialogTitle>
              <DialogDescription>
                <span className="font-mono">{employee.employeeCode}</span>
                {" - "}
                <Badge variant="outline" className={statusColors[employee.status]}>
                  {employee.status.replace("_", " ")}
                </Badge>
              </DialogDescription>
            </DialogHeader>
          </DialogHeaderContainer>

          <ScrollArea className="h-[500px] pr-4">
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="info">Basic Info</TabsTrigger>
                <TabsTrigger value="personal">Personal</TabsTrigger>
                <TabsTrigger value="statutory">Statutory</TabsTrigger>
                <TabsTrigger value="salary">Salary</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="mt-4 space-y-4">
                <div className="rounded-lg border p-4 space-y-2">
                  <DetailRow label="Department" value={employee.department} />
                  <DetailRow label="Position" value={employee.position} />
                  <DetailRow label="Employment Type" value={employee.employmentType?.replace("_", " ")} />
                  <DetailRow label="Date Joined" value={formatDate(employee.dateJoined)} />
                  {employee.dateResigned && (
                    <DetailRow label="Date Resigned" value={formatDate(employee.dateResigned)} />
                  )}
                </div>

                <div className="rounded-lg border p-4 space-y-2">
                  <h4 className="font-medium mb-2">Contact</h4>
                  <DetailRow label="Email" value={employee.email} />
                  <DetailRow label="Phone" value={employee.phone} />
                  <DetailRow label="Address" value={employee.address} />
                </div>

                <div className="rounded-lg border p-4 space-y-2">
                  <h4 className="font-medium mb-2">Bank Details</h4>
                  <DetailRow label="Bank" value={employee.bankName} />
                  <DetailRow label="Account Number" value={employee.bankAccountNumber} />
                  <DetailRow label="Account Holder" value={employee.bankAccountHolder} />
                </div>
              </TabsContent>

              <TabsContent value="personal" className="mt-4 space-y-4">
                <div className="rounded-lg border p-4 space-y-2">
                  <DetailRow label="Nationality" value={employee.nationality?.replace("_", " ")} />
                  <DetailRow label="IC Number" value={employee.icNumber} />
                  <DetailRow label="Passport Number" value={employee.passportNumber} />
                  <DetailRow label="Date of Birth" value={formatDate(employee.dateOfBirth)} />
                </div>

                <div className="rounded-lg border p-4 space-y-2">
                  <h4 className="font-medium mb-2">Tax Relief Info</h4>
                  <DetailRow label="Marital Status" value={employee.maritalStatus} />
                  <DetailRow label="Spouse Working" value={employee.spouseWorking ? "Yes" : "No"} />
                  <DetailRow label="Number of Children" value={employee.numberOfChildren?.toString()} />
                  <DetailRow label="Children in University" value={employee.childrenInUniversity?.toString()} />
                  <DetailRow label="Disabled Children" value={employee.disabledChildren?.toString()} />
                  <DetailRow label="Tax Number" value={employee.taxNumber} />
                </div>
              </TabsContent>

              <TabsContent value="statutory" className="mt-4 space-y-4">
                <div className="rounded-lg border p-4 space-y-2">
                  <h4 className="font-medium mb-2">Registration Numbers</h4>
                  <DetailRow label="EPF Number" value={employee.epfNumber} />
                  <DetailRow label="SOCSO Number" value={employee.socsoNumber} />
                  <DetailRow label="EIS Number" value={employee.eisNumber} />
                </div>

                {(employee.epfEmployeeRate || employee.epfEmployerRate) && (
                  <div className="rounded-lg border p-4 space-y-2">
                    <h4 className="font-medium mb-2">Custom EPF Rates</h4>
                    <DetailRow label="Employee Rate" value={employee.epfEmployeeRate ? `${employee.epfEmployeeRate}%` : "Standard"} />
                    <DetailRow label="Employer Rate" value={employee.epfEmployerRate ? `${employee.epfEmployerRate}%` : "Standard"} />
                  </div>
                )}
              </TabsContent>

              <TabsContent value="salary" className="mt-4 space-y-4">
                {isSalaryLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : salaryHistory?.length ? (
                  <div className="space-y-2">
                    {salaryHistory.map((salary, index) => (
                      <div
                        key={salary.id}
                        className={`rounded-lg border p-4 ${index === 0 ? "border-primary" : ""}`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium text-lg">
                              {formatCurrency(salary.baseSalary)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {salary.payFrequency.replace("_", " ")}
                            </div>
                          </div>
                          {index === 0 && (
                            <Badge variant="outline" className="bg-primary/10 text-primary">
                              Current
                            </Badge>
                          )}
                        </div>
                        <div className="mt-2 text-sm text-muted-foreground">
                          Effective: {formatDate(salary.effectiveFrom)}
                          {salary.effectiveTo && ` - ${formatDate(salary.effectiveTo)}`}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No salary records found
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </ScrollArea>
        </DialogContentContainer>
      </DialogContent>
    </Dialog>
  );
}
