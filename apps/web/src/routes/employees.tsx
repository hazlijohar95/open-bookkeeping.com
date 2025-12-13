/**
 * Employee Management Page
 * List, create, edit, and manage employees for payroll
 */

import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/ui/data-table";
import { useAuth } from "@/providers/auth-provider";
import { useEmployees, useEmployeeStats } from "@/api/payroll";
import type { Employee, EmployeeStatus } from "@/api/payroll";
import { Plus, UserIcon, UsersIcon, UserCheckIcon, ClockIcon, UserXIcon } from "@/components/ui/icons";
import { EmployeeFormModal } from "@/components/payroll/employee-form-modal";
import { EmployeeDetailModal } from "@/components/payroll/employee-detail-modal";
import { DeleteEmployeeModal } from "@/components/payroll/delete-employee-modal";
import { createEmployeeColumns, employeeColumnConfig } from "@/components/table-columns/employees";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MetricCard } from "@/components/dashboard";

export function Employees() {
  const { isLoading: isAuthLoading } = useAuth();
  const [statusFilter, setStatusFilter] = useState<EmployeeStatus | "all">("all");

  const { data: employees, isLoading } = useEmployees(
    statusFilter === "all" ? undefined : { status: statusFilter },
  );
  const { data: stats } = useEmployeeStats();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  const showSkeleton = isLoading || isAuthLoading;

  const handleView = useCallback((employee: Employee) => {
    setSelectedEmployee(employee);
    setIsDetailOpen(true);
  }, []);

  const handleEdit = useCallback((employee: Employee) => {
    setSelectedEmployee(employee);
    setIsFormOpen(true);
  }, []);

  const handleDelete = useCallback((employee: Employee) => {
    setSelectedEmployee(employee);
    setIsDeleteOpen(true);
  }, []);

  const handleFormClose = useCallback(() => {
    setIsFormOpen(false);
    setSelectedEmployee(null);
  }, []);

  const handleDetailClose = useCallback(() => {
    setIsDetailOpen(false);
    setSelectedEmployee(null);
  }, []);

  const handleDeleteClose = useCallback(() => {
    setIsDeleteOpen(false);
    setSelectedEmployee(null);
  }, []);

  const columns = useMemo(
    () => createEmployeeColumns({ onView: handleView, onEdit: handleEdit, onDelete: handleDelete }),
    [handleView, handleEdit, handleDelete]
  );

  return (
    <PageContainer>
      <PageHeader
        icon={UserIcon}
        title="Employees"
        description="Manage your employees for payroll processing"
        action={
          showSkeleton ? (
            <Skeleton className="h-8 w-32" />
          ) : (
            <Button onClick={() => setIsFormOpen(true)}>
              <Plus className="size-4 mr-2" />
              Add Employee
            </Button>
          )
        }
      />

      {/* Employee Analytics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        <MetricCard
          icon={UsersIcon}
          label="Total Workforce"
          value={stats?.total ?? 0}
          details={[
            { label: "Active", value: stats?.active ?? 0 },
            { label: "Probation", value: stats?.probation ?? 0 },
          ]}
          isLoading={showSkeleton}
        />
        <MetricCard
          icon={UserCheckIcon}
          label="Active Employees"
          value={stats?.active ?? 0}
          subValue={stats ? `${Math.round((stats.active / Math.max(stats.total, 1)) * 100)}%` : undefined}
          description="Currently employed and working"
          isLoading={showSkeleton}
        />
        <MetricCard
          icon={ClockIcon}
          label="On Probation"
          value={stats?.probation ?? 0}
          description="In probationary period"
          isLoading={showSkeleton}
        />
        <MetricCard
          icon={UserXIcon}
          label="Separated"
          value={(stats?.terminated ?? 0) + (stats?.resigned ?? 0) + (stats?.retired ?? 0)}
          details={[
            { label: "Terminated", value: stats?.terminated ?? 0 },
            { label: "Resigned", value: stats?.resigned ?? 0 },
            { label: "Retired", value: stats?.retired ?? 0 },
          ]}
          isLoading={showSkeleton}
        />
      </div>

      {/* Status Filter Tabs */}
      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as EmployeeStatus | "all")} className="mb-4">
        <div className="overflow-x-auto -mx-1 px-1 pb-2">
          <TabsList className="inline-flex w-auto min-w-full">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="probation">Probation</TabsTrigger>
            <TabsTrigger value="terminated">
              <span className="hidden sm:inline">Terminated</span>
              <span className="sm:hidden">Term</span>
            </TabsTrigger>
            <TabsTrigger value="resigned">Resigned</TabsTrigger>
            <TabsTrigger value="retired">Retired</TabsTrigger>
          </TabsList>
        </div>
      </Tabs>

      {showSkeleton ? (
        <DataTable
          columns={columns}
          data={[]}
          columnConfig={employeeColumnConfig}
          isLoading={true}
          defaultSorting={[{ id: "employeeCode", desc: false }]}
        />
      ) : !employees?.length ? (
        <EmptyState
          icon={UserIcon}
          title="No employees yet"
          description="Add your first employee to start processing payroll."
          action={
            <Button onClick={() => setIsFormOpen(true)}>
              <Plus className="size-4 mr-2" />
              Add Employee
            </Button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={employees}
          columnConfig={employeeColumnConfig}
          isLoading={false}
          defaultSorting={[{ id: "employeeCode", desc: false }]}
        />
      )}

      <EmployeeFormModal
        isOpen={isFormOpen}
        onClose={handleFormClose}
        employee={selectedEmployee}
      />
      <EmployeeDetailModal
        isOpen={isDetailOpen}
        onClose={handleDetailClose}
        employee={selectedEmployee}
      />
      <DeleteEmployeeModal
        isOpen={isDeleteOpen}
        onClose={handleDeleteClose}
        employee={selectedEmployee}
      />
    </PageContainer>
  );
}
