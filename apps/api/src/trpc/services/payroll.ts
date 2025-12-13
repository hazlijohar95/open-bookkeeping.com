/**
 * Payroll tRPC Router
 *
 * Handles:
 * - Employee management (CRUD)
 * - Salary component management
 * - Payroll run operations
 * - Pay slip operations
 * - Statutory calculations
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import {
  employeeRepository,
  employeeSalaryRepository,
  salaryComponentRepository,
  payrollRunRepository,
  paySlipRepository,
  paySlipItemRepository,
} from "@open-bookkeeping/db";
import { calculatePayroll, recalculatePaySlip } from "../../services/payroll/payroll-calculation.service";
import {
  calculateAllStatutory,
  getStatutoryWageCeilings,
} from "../../services/payroll/statutory.service";
import {
  createPayrollAccrualEntry,
  createPayrollPaymentEntry,
  reversePayrollEntry,
  getStatutoryPaymentSummary,
} from "../../services/payroll/payroll-journal.service";

// ============================================================================
// Zod Schemas
// ============================================================================

const employeeStatusSchema = z.enum([
  "active",
  "probation",
  "terminated",
  "resigned",
  "retired",
]);

const employmentTypeSchema = z.enum([
  "full_time",
  "part_time",
  "contract",
  "intern",
]);

const nationalityTypeSchema = z.enum([
  "malaysian",
  "permanent_resident",
  "foreign",
]);

const maritalStatusSchema = z.enum([
  "single",
  "married",
  "divorced",
  "widowed",
]);

const componentTypeSchema = z.enum(["earnings", "deductions"]);

const calculationMethodSchema = z.enum([
  "fixed",
  "percentage",
  "hourly",
  "daily",
]);

const payFrequencySchema = z.enum(["monthly", "bi_weekly", "weekly"]);

const payrollRunStatusSchema = z.enum([
  "draft",
  "calculating",
  "pending_review",
  "approved",
  "finalized",
  "paid",
  "cancelled",
]);

// Employee schemas
const createEmployeeSchema = z.object({
  employeeCode: z.string().min(1).max(20),
  firstName: z.string().min(1).max(100),
  lastName: z.string().max(100).optional(),
  icNumber: z.string().max(20).optional(),
  passportNumber: z.string().max(50).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  status: employeeStatusSchema.default("active"),
  employmentType: employmentTypeSchema.default("full_time"),
  nationality: nationalityTypeSchema.default("malaysian"),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateJoined: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  department: z.string().max(100).optional(),
  position: z.string().max(100).optional(),
  bankName: z.string().max(100).optional(),
  bankAccountNumber: z.string().max(50).optional(),
  bankAccountHolder: z.string().max(200).optional(),
  taxNumber: z.string().max(50).optional(),
  maritalStatus: maritalStatusSchema.optional(),
  spouseWorking: z.boolean().optional(),
  numberOfChildren: z.number().int().min(0).optional(),
  childrenInUniversity: z.number().int().min(0).optional(),
  disabledChildren: z.number().int().min(0).optional(),
  epfNumber: z.string().max(20).optional(),
  socsoNumber: z.string().max(20).optional(),
  eisNumber: z.string().max(20).optional(),
  epfEmployeeRate: z.string().optional(),
  epfEmployerRate: z.string().optional(),
  // Initial salary
  baseSalary: z.string().regex(/^\d+(\.\d{1,2})?$/),
  payFrequency: payFrequencySchema.default("monthly"),
});

const updateEmployeeSchema = z.object({
  id: z.string().uuid(),
  employeeCode: z.string().min(1).max(20).optional(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().max(100).optional().nullable(),
  icNumber: z.string().max(20).optional().nullable(),
  passportNumber: z.string().max(50).optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  status: employeeStatusSchema.optional(),
  employmentType: employmentTypeSchema.optional(),
  nationality: nationalityTypeSchema.optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  dateJoined: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateResigned: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  department: z.string().max(100).optional().nullable(),
  position: z.string().max(100).optional().nullable(),
  bankName: z.string().max(100).optional().nullable(),
  bankAccountNumber: z.string().max(50).optional().nullable(),
  bankAccountHolder: z.string().max(200).optional().nullable(),
  taxNumber: z.string().max(50).optional().nullable(),
  maritalStatus: maritalStatusSchema.optional().nullable(),
  spouseWorking: z.boolean().optional().nullable(),
  numberOfChildren: z.number().int().min(0).optional().nullable(),
  childrenInUniversity: z.number().int().min(0).optional().nullable(),
  disabledChildren: z.number().int().min(0).optional().nullable(),
  epfNumber: z.string().max(20).optional().nullable(),
  socsoNumber: z.string().max(20).optional().nullable(),
  eisNumber: z.string().max(20).optional().nullable(),
  epfEmployeeRate: z.string().optional().nullable(),
  epfEmployerRate: z.string().optional().nullable(),
});

// Salary component schemas
const createComponentSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  componentType: componentTypeSchema,
  calculationMethod: calculationMethodSchema.default("fixed"),
  defaultAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  defaultPercentage: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(),
  isEpfApplicable: z.boolean().default(true),
  isSocsoApplicable: z.boolean().default(true),
  isEisApplicable: z.boolean().default(true),
  isPcbApplicable: z.boolean().default(true),
});

const updateComponentSchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(1).max(20).optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  componentType: componentTypeSchema.optional(),
  calculationMethod: calculationMethodSchema.optional(),
  defaultAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional().nullable(),
  defaultPercentage: z.string().regex(/^\d+(\.\d{1,4})?$/).optional().nullable(),
  isEpfApplicable: z.boolean().optional(),
  isSocsoApplicable: z.boolean().optional(),
  isEisApplicable: z.boolean().optional(),
  isPcbApplicable: z.boolean().optional(),
});

// Payroll run schemas
const createPayrollRunSchema = z.object({
  name: z.string().max(100).optional(),
  periodYear: z.number().int().min(2020).max(2100),
  periodMonth: z.number().int().min(1).max(12),
  payDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  periodEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// Salary update schema
const updateSalarySchema = z.object({
  employeeId: z.string().uuid(),
  baseSalary: z.string().regex(/^\d+(\.\d{1,2})?$/),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  payFrequency: payFrequencySchema.optional(),
});

// Pay slip item schema
const addPaySlipItemSchema = z.object({
  paySlipId: z.string().uuid(),
  salaryComponentId: z.string().uuid().optional(),
  componentCode: z.string().min(1).max(20),
  componentName: z.string().min(1).max(100),
  componentType: componentTypeSchema,
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  isEpfApplicable: z.boolean().default(false),
  isSocsoApplicable: z.boolean().default(false),
  isEisApplicable: z.boolean().default(false),
  isPcbApplicable: z.boolean().default(false),
});

// ============================================================================
// Router
// ============================================================================

export const payrollRouter = router({
  // ==========================================================================
  // EMPLOYEE OPERATIONS
  // ==========================================================================

  // List employees
  listEmployees: protectedProcedure
    .input(
      z.object({
        status: employeeStatusSchema.optional(),
        employmentType: employmentTypeSchema.optional(),
        department: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const { limit, offset, ...filters } = input ?? { limit: 50, offset: 0 };
      return employeeRepository.findMany(ctx.user.id, {
        ...filters,
        limit,
        offset,
      });
    }),

  // Get employee by ID
  getEmployee: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const employee = await employeeRepository.findById(input.id, ctx.user.id);
      if (!employee) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Employee not found" });
      }
      return employee;
    }),

  // Create employee
  createEmployee: protectedProcedure
    .input(createEmployeeSchema)
    .mutation(async ({ ctx, input }) => {
      const { baseSalary, payFrequency, ...employeeData } = input;

      // Check if employee code exists
      const exists = await employeeRepository.codeExists(input.employeeCode, ctx.user.id);
      if (exists) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Employee code already exists",
        });
      }

      // Create employee
      const employee = await employeeRepository.create({
        userId: ctx.user.id,
        ...employeeData,
      });

      if (!employee) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create employee",
        });
      }

      // Create initial salary record
      await employeeSalaryRepository.create({
        employeeId: employee.id,
        baseSalary,
        effectiveFrom: input.dateJoined,
        payFrequency,
      });

      return employee;
    }),

  // Update employee
  updateEmployee: protectedProcedure
    .input(updateEmployeeSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      // Check if employee exists
      const existing = await employeeRepository.findById(id, ctx.user.id);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Employee not found" });
      }

      // Check employee code uniqueness if being changed
      if (data.employeeCode && data.employeeCode !== existing.employeeCode) {
        const exists = await employeeRepository.codeExists(data.employeeCode, ctx.user.id, id);
        if (exists) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Employee code already exists",
          });
        }
      }

      // Convert null to undefined for fields that don't accept null
      const updateData = {
        ...data,
        maritalStatus: data.maritalStatus === null ? undefined : data.maritalStatus,
        spouseWorking: data.spouseWorking === null ? undefined : data.spouseWorking,
        numberOfChildren: data.numberOfChildren === null ? undefined : data.numberOfChildren,
        childrenInUniversity: data.childrenInUniversity === null ? undefined : data.childrenInUniversity,
        disabledChildren: data.disabledChildren === null ? undefined : data.disabledChildren,
      };

      return employeeRepository.update(id, ctx.user.id, updateData);
    }),

  // Terminate employee
  terminateEmployee: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        terminationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        status: z.enum(["terminated", "resigned", "retired"]).default("terminated"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const employee = await employeeRepository.findById(input.id, ctx.user.id);
      if (!employee) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Employee not found" });
      }

      // First update status if needed
      if (input.status !== "terminated") {
        await employeeRepository.update(input.id, ctx.user.id, { status: input.status });
      }

      return employeeRepository.terminate(
        input.id,
        ctx.user.id,
        input.terminationDate
      );
    }),

  // Delete employee (soft delete)
  deleteEmployee: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const employee = await employeeRepository.findById(input.id, ctx.user.id);
      if (!employee) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Employee not found" });
      }

      return employeeRepository.delete(input.id, ctx.user.id);
    }),

  // Get salary history
  getSalaryHistory: protectedProcedure
    .input(z.object({ employeeId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const employee = await employeeRepository.findById(input.employeeId, ctx.user.id);
      if (!employee) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Employee not found" });
      }

      return employeeSalaryRepository.getSalaryHistory(input.employeeId);
    }),

  // Update salary
  updateSalary: protectedProcedure
    .input(updateSalarySchema)
    .mutation(async ({ ctx, input }) => {
      const employee = await employeeRepository.findById(input.employeeId, ctx.user.id);
      if (!employee) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Employee not found" });
      }

      return employeeSalaryRepository.create({
        employeeId: input.employeeId,
        baseSalary: input.baseSalary,
        effectiveFrom: input.effectiveFrom,
        payFrequency: input.payFrequency,
      });
    }),

  // Get departments list
  getDepartments: protectedProcedure.query(async ({ ctx }) => {
    return employeeRepository.getDepartments(ctx.user.id);
  }),

  // ==========================================================================
  // SALARY COMPONENT OPERATIONS
  // ==========================================================================

  // List salary components
  listComponents: protectedProcedure
    .input(
      z.object({
        componentType: componentTypeSchema.optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      return salaryComponentRepository.findMany(ctx.user.id, input?.componentType);
    }),

  // Create salary component
  createComponent: protectedProcedure
    .input(createComponentSchema)
    .mutation(async ({ ctx, input }) => {
      const exists = await salaryComponentRepository.codeExists(input.code, ctx.user.id);
      if (exists) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Component code already exists",
        });
      }

      return salaryComponentRepository.create({
        userId: ctx.user.id,
        ...input,
      });
    }),

  // Update salary component
  updateComponent: protectedProcedure
    .input(updateComponentSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const existing = await salaryComponentRepository.findById(id, ctx.user.id);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Component not found" });
      }

      if (data.code && data.code !== existing.code) {
        const exists = await salaryComponentRepository.codeExists(data.code, ctx.user.id, id);
        if (exists) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Component code already exists",
          });
        }
      }

      return salaryComponentRepository.update(id, ctx.user.id, data);
    }),

  // Delete salary component
  deleteComponent: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const component = await salaryComponentRepository.findById(input.id, ctx.user.id);
      if (!component) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Component not found" });
      }

      return salaryComponentRepository.delete(input.id, ctx.user.id);
    }),

  // ==========================================================================
  // PAYROLL RUN OPERATIONS
  // ==========================================================================

  // List payroll runs
  listPayrollRuns: protectedProcedure
    .input(
      z.object({
        year: z.number().int().optional(),
        status: payrollRunStatusSchema.optional(),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const { limit, offset, ...filters } = input ?? { limit: 20, offset: 0 };
      return payrollRunRepository.findMany(ctx.user.id, {
        ...filters,
        limit,
        offset,
      });
    }),

  // Get payroll run by ID
  getPayrollRun: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const run = await payrollRunRepository.findById(input.id, ctx.user.id);
      if (!run) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Payroll run not found" });
      }
      return run;
    }),

  // Create payroll run
  createPayrollRun: protectedProcedure
    .input(createPayrollRunSchema)
    .mutation(async ({ ctx, input }) => {
      // Check if period already exists (excludes cancelled runs)
      const exists = await payrollRunRepository.periodExists(
        ctx.user.id,
        input.periodYear,
        input.periodMonth
      );
      if (exists) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Payroll run for this period already exists",
        });
      }

      // Hard-delete any cancelled runs for this period (to avoid unique constraint violation)
      await payrollRunRepository.deleteCancelledForPeriod(
        ctx.user.id,
        input.periodYear,
        input.periodMonth
      );

      // Generate run number
      const runNumber = await payrollRunRepository.getNextRunNumber(ctx.user.id, input.periodYear);

      // Calculate period dates if not provided
      const periodStartDate = input.periodStartDate ||
        `${input.periodYear}-${input.periodMonth.toString().padStart(2, "0")}-01`;
      const lastDay = new Date(input.periodYear, input.periodMonth, 0).getDate();
      const periodEndDate = input.periodEndDate ||
        `${input.periodYear}-${input.periodMonth.toString().padStart(2, "0")}-${lastDay}`;

      return payrollRunRepository.create({
        userId: ctx.user.id,
        runNumber,
        name: input.name || `Payroll ${input.periodMonth}/${input.periodYear}`,
        periodYear: input.periodYear,
        periodMonth: input.periodMonth,
        payDate: input.payDate,
        periodStartDate,
        periodEndDate,
      });
    }),

  // Calculate payroll
  calculatePayroll: protectedProcedure
    .input(z.object({ payrollRunId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const run = await payrollRunRepository.findById(input.payrollRunId, ctx.user.id);
      if (!run) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Payroll run not found" });
      }

      if (!["draft", "pending_review"].includes(run.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Payroll can only be calculated when in draft or pending review status",
        });
      }

      const result = await calculatePayroll({
        userId: ctx.user.id,
        payrollRunId: input.payrollRunId,
        periodYear: run.periodYear,
        periodMonth: run.periodMonth,
        runNumber: run.runNumber,
      });

      return result;
    }),

  // Approve payroll run
  approvePayrollRun: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const run = await payrollRunRepository.findById(input.id, ctx.user.id);
      if (!run) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Payroll run not found" });
      }

      if (run.status !== "pending_review") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Payroll can only be approved when in pending review status",
        });
      }

      return payrollRunRepository.updateStatus(input.id, ctx.user.id, "approved", ctx.user.id);
    }),

  // Finalize payroll run (creates journal entry)
  finalizePayrollRun: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const run = await payrollRunRepository.findById(input.id, ctx.user.id);
      if (!run) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Payroll run not found" });
      }

      if (run.status !== "approved") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Payroll can only be finalized when in approved status",
        });
      }

      // Create accrual journal entry
      const journalEntryId = await createPayrollAccrualEntry(ctx.user.id, run);
      if (!journalEntryId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create payroll journal entry",
        });
      }

      // Update status and link journal entry
      await payrollRunRepository.updateStatus(input.id, ctx.user.id, "finalized", ctx.user.id);

      // Update pay slips to approved status
      await paySlipRepository.bulkUpdateStatus(input.id, "approved");

      return payrollRunRepository.findById(input.id, ctx.user.id);
    }),

  // Mark payroll as paid
  markPayrollPaid: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        bankAccountId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const run = await payrollRunRepository.findById(input.id, ctx.user.id);
      if (!run) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Payroll run not found" });
      }

      if (run.status !== "finalized") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Payroll can only be marked paid when finalized",
        });
      }

      // Create payment journal entry
      await createPayrollPaymentEntry(ctx.user.id, run, input.paymentDate, input.bankAccountId);

      // Update status
      await payrollRunRepository.updateStatus(input.id, ctx.user.id, "paid", ctx.user.id);

      // Update pay slips to paid status
      await paySlipRepository.bulkUpdateStatus(input.id, "paid");

      return payrollRunRepository.findById(input.id, ctx.user.id);
    }),

  // Cancel payroll run
  cancelPayrollRun: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const run = await payrollRunRepository.findById(input.id, ctx.user.id);
      if (!run) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Payroll run not found" });
      }

      if (run.status === "paid") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Paid payroll cannot be cancelled",
        });
      }

      // Reverse journal entry if exists
      if (run.journalEntryId) {
        await reversePayrollEntry(ctx.user.id, run.journalEntryId);
      }

      // Update status
      await payrollRunRepository.updateStatus(input.id, ctx.user.id, "cancelled", ctx.user.id);

      // Update pay slips to cancelled status
      await paySlipRepository.bulkUpdateStatus(input.id, "cancelled");

      return payrollRunRepository.findById(input.id, ctx.user.id);
    }),

  // Delete payroll run (only draft)
  deletePayrollRun: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const run = await payrollRunRepository.findById(input.id, ctx.user.id);
      if (!run) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Payroll run not found" });
      }

      if (run.status !== "draft") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only draft payroll runs can be deleted",
        });
      }

      return payrollRunRepository.delete(input.id, ctx.user.id);
    }),

  // ==========================================================================
  // PAY SLIP OPERATIONS
  // ==========================================================================

  // Get pay slips for a payroll run
  getPaySlips: protectedProcedure
    .input(z.object({ payrollRunId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const run = await payrollRunRepository.findById(input.payrollRunId, ctx.user.id);
      if (!run) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Payroll run not found" });
      }

      return paySlipRepository.findByPayrollRun(input.payrollRunId);
    }),

  // Get pay slip by ID with items
  getPaySlip: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const paySlip = await paySlipRepository.findById(input.id);
      if (!paySlip) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pay slip not found" });
      }

      // Verify user owns this pay slip via payroll run
      const run = await payrollRunRepository.findById(paySlip.payrollRunId, ctx.user.id);
      if (!run) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pay slip not found" });
      }

      // Get items
      const items = await paySlipItemRepository.findByPaySlip(input.id);

      return { ...paySlip, items };
    }),

  // Get employee pay slip history
  getEmployeePayHistory: protectedProcedure
    .input(
      z.object({
        employeeId: z.string().uuid(),
        limit: z.number().int().min(1).max(50).default(12),
      })
    )
    .query(async ({ ctx, input }) => {
      const employee = await employeeRepository.findById(input.employeeId, ctx.user.id);
      if (!employee) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Employee not found" });
      }

      return paySlipRepository.findByEmployee(input.employeeId, input.limit);
    }),

  // Add item to pay slip
  addPaySlipItem: protectedProcedure
    .input(addPaySlipItemSchema)
    .mutation(async ({ ctx, input }) => {
      const paySlip = await paySlipRepository.findById(input.paySlipId);
      if (!paySlip) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pay slip not found" });
      }

      // Verify ownership and status
      const run = await payrollRunRepository.findById(paySlip.payrollRunId, ctx.user.id);
      if (!run) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pay slip not found" });
      }

      if (!["draft", "pending_review"].includes(run.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot modify pay slip in current status",
        });
      }

      // Get current max sort order
      const items = await paySlipItemRepository.findByPaySlip(input.paySlipId);
      const maxSortOrder = items.reduce((max, item) => Math.max(max, item.sortOrder ?? 0), 0);

      return paySlipItemRepository.create({
        paySlipId: input.paySlipId,
        salaryComponentId: input.salaryComponentId,
        componentCode: input.componentCode,
        componentName: input.componentName,
        componentType: input.componentType,
        amount: input.amount,
        isEpfApplicable: input.isEpfApplicable,
        isSocsoApplicable: input.isSocsoApplicable,
        isEisApplicable: input.isEisApplicable,
        isPcbApplicable: input.isPcbApplicable,
        sortOrder: maxSortOrder + 1,
      });
    }),

  // Remove item from pay slip
  removePaySlipItem: protectedProcedure
    .input(z.object({ itemId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const item = await paySlipItemRepository.findById(input.itemId);
      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pay slip item not found" });
      }

      const paySlip = await paySlipRepository.findById(item.paySlipId);
      if (!paySlip) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pay slip not found" });
      }

      // Verify ownership and status
      const run = await payrollRunRepository.findById(paySlip.payrollRunId, ctx.user.id);
      if (!run) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pay slip not found" });
      }

      if (!["draft", "pending_review"].includes(run.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot modify pay slip in current status",
        });
      }

      return paySlipItemRepository.delete(input.itemId);
    }),

  // Recalculate single pay slip
  recalculatePaySlip: protectedProcedure
    .input(z.object({ paySlipId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const paySlip = await paySlipRepository.findById(input.paySlipId);
      if (!paySlip) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pay slip not found" });
      }

      const run = await payrollRunRepository.findById(paySlip.payrollRunId, ctx.user.id);
      if (!run) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pay slip not found" });
      }

      if (!["draft", "pending_review"].includes(run.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot recalculate pay slip in current status",
        });
      }

      return recalculatePaySlip(input.paySlipId, ctx.user.id);
    }),

  // ==========================================================================
  // STATUTORY & UTILITY OPERATIONS
  // ==========================================================================

  // Get statutory wage ceilings
  getStatutoryInfo: protectedProcedure.query(async () => {
    return {
      wageCeilings: getStatutoryWageCeilings(),
      epfRates: {
        malaysian_under60_low: { employer: 13, employee: 11, note: "Wages <= RM5,000" },
        malaysian_under60_high: { employer: 12, employee: 11, note: "Wages > RM5,000" },
        malaysian_60plus: { employer: 4, employee: 0 },
        foreign: { employer: 2, employee: 2, note: "Effective Oct 2025" },
      },
      socsoRates: {
        category1: { employer: 1.75, employee: 0.5, note: "Under 60" },
        category2: { employer: 1.25, employee: 0, note: "60 and above" },
      },
      eisRate: { employer: 0.2, employee: 0.2 },
    };
  }),

  // Calculate statutory for preview
  calculateStatutory: protectedProcedure
    .input(
      z.object({
        grossWage: z.string().regex(/^\d+(\.\d{1,2})?$/),
        nationality: nationalityTypeSchema,
        dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        maritalStatus: maritalStatusSchema.optional(),
        spouseWorking: z.boolean().optional(),
        numberOfChildren: z.number().int().min(0).optional(),
        childrenInUniversity: z.number().int().min(0).optional(),
        disabledChildren: z.number().int().min(0).optional(),
        currentMonth: z.number().int().min(1).max(12),
        ytdGross: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
        ytdEpf: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
        ytdPcb: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
      })
    )
    .query(async ({ input }) => {
      return calculateAllStatutory({
        grossWage: input.grossWage,
        employee: {
          nationality: input.nationality,
          dateOfBirth: input.dateOfBirth ?? null,
          maritalStatus: input.maritalStatus ?? "single",
          spouseWorking: input.spouseWorking ?? true,
          numberOfChildren: input.numberOfChildren ?? 0,
          childrenInUniversity: input.childrenInUniversity ?? 0,
          disabledChildren: input.disabledChildren ?? 0,
        },
        currentMonth: input.currentMonth,
        ytdGross: input.ytdGross ?? "0",
        ytdEpf: input.ytdEpf ?? "0",
        ytdPcb: input.ytdPcb ?? "0",
      });
    }),

  // Get statutory payment summary for a payroll run
  getStatutoryPaymentSummary: protectedProcedure
    .input(z.object({ payrollRunId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const run = await payrollRunRepository.findById(input.payrollRunId, ctx.user.id);
      if (!run) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Payroll run not found" });
      }

      return getStatutoryPaymentSummary(ctx.user.id, run);
    }),

  // Get employee count by status
  getEmployeeStats: protectedProcedure.query(async ({ ctx }) => {
    const counts = await Promise.all([
      employeeRepository.count(ctx.user.id, "active"),
      employeeRepository.count(ctx.user.id, "probation"),
      employeeRepository.count(ctx.user.id, "terminated"),
      employeeRepository.count(ctx.user.id, "resigned"),
      employeeRepository.count(ctx.user.id, "retired"),
      employeeRepository.count(ctx.user.id),
    ]);

    return {
      active: counts[0],
      probation: counts[1],
      terminated: counts[2],
      resigned: counts[3],
      retired: counts[4],
      total: counts[5],
    };
  }),
});
