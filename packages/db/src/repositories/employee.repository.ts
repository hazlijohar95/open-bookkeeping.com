import { eq, and, or, ilike, isNull, desc, gte, lte } from "drizzle-orm";
import { db } from "../index";
import {
  employees,
  employeeSalaries,
  salaryComponents,
  type EmployeeStatus,
  type EmploymentType,
  type NationalityType,
  type MaritalStatus,
  type SalaryComponentType,
  type CalculationMethod,
  type PayFrequency,
} from "../schema";

// ============================================================================
// INPUT TYPES
// ============================================================================

export interface CreateEmployeeInput {
  userId: string;
  employeeCode: string;
  firstName: string;
  lastName?: string | null;
  icNumber?: string | null;
  passportNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  status?: EmployeeStatus;
  employmentType?: EmploymentType;
  nationality?: NationalityType;
  dateOfBirth?: string | null;
  dateJoined: string;
  dateResigned?: string | null;
  probationEndDate?: string | null;
  department?: string | null;
  position?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountHolder?: string | null;
  taxNumber?: string | null;
  maritalStatus?: MaritalStatus;
  spouseWorking?: boolean;
  numberOfChildren?: number;
  childrenInUniversity?: number;
  disabledChildren?: number;
  epfNumber?: string | null;
  socsoNumber?: string | null;
  eisNumber?: string | null;
  epfEmployeeRate?: string | null;
  epfEmployerRate?: string | null;
  // Initial salary (optional)
  initialSalary?: {
    baseSalary: string;
    currency?: string;
    payFrequency?: PayFrequency;
  };
}

export interface UpdateEmployeeInput {
  firstName?: string;
  lastName?: string | null;
  icNumber?: string | null;
  passportNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  status?: EmployeeStatus;
  employmentType?: EmploymentType;
  nationality?: NationalityType;
  dateOfBirth?: string | null;
  dateResigned?: string | null;
  probationEndDate?: string | null;
  department?: string | null;
  position?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountHolder?: string | null;
  taxNumber?: string | null;
  maritalStatus?: MaritalStatus;
  spouseWorking?: boolean;
  numberOfChildren?: number;
  childrenInUniversity?: number;
  disabledChildren?: number;
  epfNumber?: string | null;
  socsoNumber?: string | null;
  eisNumber?: string | null;
  epfEmployeeRate?: string | null;
  epfEmployerRate?: string | null;
}

export interface CreateSalaryInput {
  employeeId: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  baseSalary: string;
  currency?: string;
  payFrequency?: PayFrequency;
  notes?: string | null;
}

export interface CreateSalaryComponentInput {
  userId: string;
  code: string;
  name: string;
  description?: string | null;
  componentType: SalaryComponentType;
  calculationMethod?: CalculationMethod;
  defaultAmount?: string | null;
  defaultPercentage?: string | null;
  isEpfApplicable?: boolean;
  isSocsoApplicable?: boolean;
  isEisApplicable?: boolean;
  isPcbApplicable?: boolean;
  sortOrder?: number;
}

export interface UpdateSalaryComponentInput {
  name?: string;
  description?: string | null;
  calculationMethod?: CalculationMethod;
  defaultAmount?: string | null;
  defaultPercentage?: string | null;
  isEpfApplicable?: boolean;
  isSocsoApplicable?: boolean;
  isEisApplicable?: boolean;
  isPcbApplicable?: boolean;
  sortOrder?: number;
  isActive?: boolean;
}

export interface EmployeeQueryOptions {
  limit?: number;
  offset?: number;
  status?: EmployeeStatus;
  department?: string;
  includeInactive?: boolean;
}

// ============================================================================
// EMPLOYEE REPOSITORY
// ============================================================================

export const employeeRepository = {
  // Find employee by ID
  findById: async (id: string, userId: string) => {
    return db.query.employees.findFirst({
      where: and(
        eq(employees.id, id),
        eq(employees.userId, userId),
        isNull(employees.deletedAt)
      ),
      with: {
        salaries: {
          orderBy: (salaries, { desc }) => [desc(salaries.effectiveFrom)],
        },
      },
    });
  },

  // Find employee by code
  findByCode: async (code: string, userId: string) => {
    return db.query.employees.findFirst({
      where: and(
        eq(employees.employeeCode, code),
        eq(employees.userId, userId),
        isNull(employees.deletedAt)
      ),
      with: {
        salaries: {
          orderBy: (salaries, { desc }) => [desc(salaries.effectiveFrom)],
        },
      },
    });
  },

  // List employees with filters
  findMany: async (userId: string, options?: EmployeeQueryOptions) => {
    const { limit = 50, offset = 0, status, department, includeInactive } = options ?? {};

    const conditions = [eq(employees.userId, userId)];

    if (!includeInactive) {
      conditions.push(isNull(employees.deletedAt));
    }

    if (status) {
      conditions.push(eq(employees.status, status));
    }

    if (department) {
      conditions.push(eq(employees.department, department));
    }

    return db.query.employees.findMany({
      where: and(...conditions),
      with: {
        salaries: {
          orderBy: (salaries, { desc }) => [desc(salaries.effectiveFrom)],
          limit: 1, // Only get current salary
        },
      },
      limit,
      offset,
      orderBy: [desc(employees.createdAt)],
    });
  },

  // Get active employees for payroll
  findActiveForPayroll: async (userId: string) => {
    return db.query.employees.findMany({
      where: and(
        eq(employees.userId, userId),
        eq(employees.status, "active"),
        isNull(employees.deletedAt)
      ),
      with: {
        salaries: {
          orderBy: (salaries, { desc }) => [desc(salaries.effectiveFrom)],
          limit: 1,
        },
      },
      orderBy: [desc(employees.employeeCode)],
    });
  },

  // Search employees
  search: async (userId: string, query: string, limit = 10) => {
    if (!query.trim()) {
      return [];
    }

    const searchPattern = `%${query}%`;

    return db.query.employees.findMany({
      where: and(
        eq(employees.userId, userId),
        isNull(employees.deletedAt),
        or(
          ilike(employees.firstName, searchPattern),
          ilike(employees.lastName, searchPattern),
          ilike(employees.employeeCode, searchPattern),
          ilike(employees.email, searchPattern),
          ilike(employees.icNumber, searchPattern)
        )
      ),
      limit,
      orderBy: (employees, { asc }) => [asc(employees.employeeCode)],
    });
  },

  // Create employee
  create: async (input: CreateEmployeeInput) => {
    return db.transaction(async (tx) => {
      const [employee] = await tx
        .insert(employees)
        .values({
          userId: input.userId,
          employeeCode: input.employeeCode,
          firstName: input.firstName,
          lastName: input.lastName ?? null,
          icNumber: input.icNumber ?? null,
          passportNumber: input.passportNumber ?? null,
          email: input.email ?? null,
          phone: input.phone ?? null,
          address: input.address ?? null,
          status: input.status ?? "active",
          employmentType: input.employmentType ?? "full_time",
          nationality: input.nationality ?? "malaysian",
          dateOfBirth: input.dateOfBirth ?? null,
          dateJoined: input.dateJoined,
          dateResigned: input.dateResigned ?? null,
          probationEndDate: input.probationEndDate ?? null,
          department: input.department ?? null,
          position: input.position ?? null,
          bankName: input.bankName ?? null,
          bankAccountNumber: input.bankAccountNumber ?? null,
          bankAccountHolder: input.bankAccountHolder ?? null,
          taxNumber: input.taxNumber ?? null,
          maritalStatus: input.maritalStatus ?? "single",
          spouseWorking: input.spouseWorking ?? true,
          numberOfChildren: input.numberOfChildren ?? 0,
          childrenInUniversity: input.childrenInUniversity ?? 0,
          disabledChildren: input.disabledChildren ?? 0,
          epfNumber: input.epfNumber || null,
          socsoNumber: input.socsoNumber || null,
          eisNumber: input.eisNumber || null,
          epfEmployeeRate: input.epfEmployeeRate || null,
          epfEmployerRate: input.epfEmployerRate || null,
        })
        .returning();

      // Create initial salary if provided
      if (input.initialSalary && employee) {
        await tx.insert(employeeSalaries).values({
          employeeId: employee.id,
          effectiveFrom: input.dateJoined,
          baseSalary: input.initialSalary.baseSalary,
          currency: input.initialSalary.currency ?? "MYR",
          payFrequency: input.initialSalary.payFrequency ?? "monthly",
        });
      }

      return employee;
    });
  },

  // Update employee
  update: async (id: string, userId: string, input: UpdateEmployeeInput) => {
    const existingEmployee = await db.query.employees.findFirst({
      where: and(
        eq(employees.id, id),
        eq(employees.userId, userId),
        isNull(employees.deletedAt)
      ),
    });

    if (!existingEmployee) {
      return null;
    }

    const [updated] = await db
      .update(employees)
      .set({
        firstName: input.firstName ?? existingEmployee.firstName,
        lastName: input.lastName !== undefined ? input.lastName : existingEmployee.lastName,
        icNumber: input.icNumber !== undefined ? input.icNumber : existingEmployee.icNumber,
        passportNumber: input.passportNumber !== undefined ? input.passportNumber : existingEmployee.passportNumber,
        email: input.email !== undefined ? input.email : existingEmployee.email,
        phone: input.phone !== undefined ? input.phone : existingEmployee.phone,
        address: input.address !== undefined ? input.address : existingEmployee.address,
        status: input.status ?? existingEmployee.status,
        employmentType: input.employmentType ?? existingEmployee.employmentType,
        nationality: input.nationality ?? existingEmployee.nationality,
        dateOfBirth: input.dateOfBirth !== undefined ? input.dateOfBirth : existingEmployee.dateOfBirth,
        dateResigned: input.dateResigned !== undefined ? input.dateResigned : existingEmployee.dateResigned,
        probationEndDate: input.probationEndDate !== undefined ? input.probationEndDate : existingEmployee.probationEndDate,
        department: input.department !== undefined ? input.department : existingEmployee.department,
        position: input.position !== undefined ? input.position : existingEmployee.position,
        bankName: input.bankName !== undefined ? input.bankName : existingEmployee.bankName,
        bankAccountNumber: input.bankAccountNumber !== undefined ? input.bankAccountNumber : existingEmployee.bankAccountNumber,
        bankAccountHolder: input.bankAccountHolder !== undefined ? input.bankAccountHolder : existingEmployee.bankAccountHolder,
        taxNumber: input.taxNumber !== undefined ? input.taxNumber : existingEmployee.taxNumber,
        maritalStatus: input.maritalStatus ?? existingEmployee.maritalStatus,
        spouseWorking: input.spouseWorking ?? existingEmployee.spouseWorking,
        numberOfChildren: input.numberOfChildren ?? existingEmployee.numberOfChildren,
        childrenInUniversity: input.childrenInUniversity ?? existingEmployee.childrenInUniversity,
        disabledChildren: input.disabledChildren ?? existingEmployee.disabledChildren,
        epfNumber: input.epfNumber !== undefined ? (input.epfNumber || null) : existingEmployee.epfNumber,
        socsoNumber: input.socsoNumber !== undefined ? (input.socsoNumber || null) : existingEmployee.socsoNumber,
        eisNumber: input.eisNumber !== undefined ? (input.eisNumber || null) : existingEmployee.eisNumber,
        epfEmployeeRate: input.epfEmployeeRate !== undefined ? (input.epfEmployeeRate || null) : existingEmployee.epfEmployeeRate,
        epfEmployerRate: input.epfEmployerRate !== undefined ? (input.epfEmployerRate || null) : existingEmployee.epfEmployerRate,
        updatedAt: new Date(),
      })
      .where(and(eq(employees.id, id), eq(employees.userId, userId)))
      .returning();

    return updated;
  },

  // Soft delete employee
  delete: async (id: string, userId: string) => {
    const existingEmployee = await db.query.employees.findFirst({
      where: and(
        eq(employees.id, id),
        eq(employees.userId, userId),
        isNull(employees.deletedAt)
      ),
    });

    if (!existingEmployee) {
      return false;
    }

    await db
      .update(employees)
      .set({ deletedAt: new Date() })
      .where(and(eq(employees.id, id), eq(employees.userId, userId)));

    return true;
  },

  // Terminate employee
  terminate: async (id: string, userId: string, dateResigned: string) => {
    const existingEmployee = await db.query.employees.findFirst({
      where: and(
        eq(employees.id, id),
        eq(employees.userId, userId),
        isNull(employees.deletedAt)
      ),
    });

    if (!existingEmployee) {
      return null;
    }

    const [updated] = await db
      .update(employees)
      .set({
        status: "resigned",
        dateResigned,
        updatedAt: new Date(),
      })
      .where(and(eq(employees.id, id), eq(employees.userId, userId)))
      .returning();

    return updated;
  },

  // Check if employee code exists
  codeExists: async (code: string, userId: string, excludeId?: string) => {
    const conditions = [
      eq(employees.employeeCode, code),
      eq(employees.userId, userId),
      isNull(employees.deletedAt),
    ];

    if (excludeId) {
      // We need to filter out this ID when checking
      const employee = await db.query.employees.findFirst({
        where: and(...conditions),
        columns: { id: true },
      });
      return employee ? employee.id !== excludeId : false;
    }

    const employee = await db.query.employees.findFirst({
      where: and(...conditions),
      columns: { id: true },
    });
    return !!employee;
  },

  // Get unique departments
  getDepartments: async (userId: string) => {
    const result = await db.query.employees.findMany({
      where: and(
        eq(employees.userId, userId),
        isNull(employees.deletedAt)
      ),
      columns: { department: true },
    });

    const departments = new Set<string>();
    result.forEach((e) => {
      if (e.department) departments.add(e.department);
    });
    return Array.from(departments).sort();
  },

  // Get employee count
  count: async (userId: string, status?: EmployeeStatus) => {
    const conditions = [
      eq(employees.userId, userId),
      isNull(employees.deletedAt),
    ];

    if (status) {
      conditions.push(eq(employees.status, status));
    }

    const result = await db.query.employees.findMany({
      where: and(...conditions),
      columns: { id: true },
    });

    return result.length;
  },
};

// ============================================================================
// SALARY REPOSITORY
// ============================================================================

export const employeeSalaryRepository = {
  // Get current salary for employee
  getCurrentSalary: async (employeeId: string) => {
    const today: string = new Date().toISOString().split("T")[0] ?? "";

    return db.query.employeeSalaries.findFirst({
      where: and(
        eq(employeeSalaries.employeeId, employeeId),
        lte(employeeSalaries.effectiveFrom, today),
        or(
          isNull(employeeSalaries.effectiveTo),
          gte(employeeSalaries.effectiveTo, today)
        )
      ),
      orderBy: [desc(employeeSalaries.effectiveFrom)],
    });
  },

  // Get salary history
  getSalaryHistory: async (employeeId: string) => {
    return db.query.employeeSalaries.findMany({
      where: eq(employeeSalaries.employeeId, employeeId),
      orderBy: [desc(employeeSalaries.effectiveFrom)],
    });
  },

  // Get salary effective at a specific date
  getSalaryAtDate: async (employeeId: string, date: string) => {
    return db.query.employeeSalaries.findFirst({
      where: and(
        eq(employeeSalaries.employeeId, employeeId),
        lte(employeeSalaries.effectiveFrom, date),
        or(
          isNull(employeeSalaries.effectiveTo),
          gte(employeeSalaries.effectiveTo, date)
        )
      ),
      orderBy: [desc(employeeSalaries.effectiveFrom)],
    });
  },

  // Create new salary record (and close previous if exists)
  create: async (input: CreateSalaryInput) => {
    return db.transaction(async (tx) => {
      // Close any previous open salary
      await tx
        .update(employeeSalaries)
        .set({
          effectiveTo: input.effectiveFrom,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(employeeSalaries.employeeId, input.employeeId),
            isNull(employeeSalaries.effectiveTo),
            lte(employeeSalaries.effectiveFrom, input.effectiveFrom)
          )
        );

      // Create new salary record
      const [salary] = await tx
        .insert(employeeSalaries)
        .values({
          employeeId: input.employeeId,
          effectiveFrom: input.effectiveFrom,
          effectiveTo: input.effectiveTo ?? null,
          baseSalary: input.baseSalary,
          currency: input.currency ?? "MYR",
          payFrequency: input.payFrequency ?? "monthly",
          notes: input.notes ?? null,
        })
        .returning();

      return salary;
    });
  },
};

// ============================================================================
// SALARY COMPONENT REPOSITORY
// ============================================================================

export const salaryComponentRepository = {
  // Find by ID
  findById: async (id: string, userId: string) => {
    return db.query.salaryComponents.findFirst({
      where: and(
        eq(salaryComponents.id, id),
        eq(salaryComponents.userId, userId),
        isNull(salaryComponents.deletedAt)
      ),
    });
  },

  // Find by code
  findByCode: async (code: string, userId: string) => {
    return db.query.salaryComponents.findFirst({
      where: and(
        eq(salaryComponents.code, code),
        eq(salaryComponents.userId, userId),
        isNull(salaryComponents.deletedAt)
      ),
    });
  },

  // List all components
  findMany: async (userId: string, componentType?: SalaryComponentType) => {
    const conditions = [
      eq(salaryComponents.userId, userId),
      isNull(salaryComponents.deletedAt),
      eq(salaryComponents.isActive, true),
    ];

    if (componentType) {
      conditions.push(eq(salaryComponents.componentType, componentType));
    }

    return db.query.salaryComponents.findMany({
      where: and(...conditions),
      orderBy: (components, { asc }) => [
        asc(components.componentType),
        asc(components.sortOrder),
        asc(components.name),
      ],
    });
  },

  // Create component
  create: async (input: CreateSalaryComponentInput) => {
    const [component] = await db
      .insert(salaryComponents)
      .values({
        userId: input.userId,
        code: input.code,
        name: input.name,
        description: input.description ?? null,
        componentType: input.componentType,
        calculationMethod: input.calculationMethod ?? "fixed",
        defaultAmount: input.defaultAmount || null,
        defaultPercentage: input.defaultPercentage || null,
        isEpfApplicable: input.isEpfApplicable ?? true,
        isSocsoApplicable: input.isSocsoApplicable ?? true,
        isEisApplicable: input.isEisApplicable ?? true,
        isPcbApplicable: input.isPcbApplicable ?? true,
        sortOrder: input.sortOrder ?? 0,
      })
      .returning();

    return component;
  },

  // Update component
  update: async (id: string, userId: string, input: UpdateSalaryComponentInput) => {
    const existingComponent = await db.query.salaryComponents.findFirst({
      where: and(
        eq(salaryComponents.id, id),
        eq(salaryComponents.userId, userId),
        isNull(salaryComponents.deletedAt)
      ),
    });

    if (!existingComponent) {
      return null;
    }

    const [updated] = await db
      .update(salaryComponents)
      .set({
        name: input.name ?? existingComponent.name,
        description: input.description !== undefined ? input.description : existingComponent.description,
        calculationMethod: input.calculationMethod ?? existingComponent.calculationMethod,
        defaultAmount: input.defaultAmount !== undefined ? (input.defaultAmount || null) : existingComponent.defaultAmount,
        defaultPercentage: input.defaultPercentage !== undefined ? (input.defaultPercentage || null) : existingComponent.defaultPercentage,
        isEpfApplicable: input.isEpfApplicable ?? existingComponent.isEpfApplicable,
        isSocsoApplicable: input.isSocsoApplicable ?? existingComponent.isSocsoApplicable,
        isEisApplicable: input.isEisApplicable ?? existingComponent.isEisApplicable,
        isPcbApplicable: input.isPcbApplicable ?? existingComponent.isPcbApplicable,
        sortOrder: input.sortOrder ?? existingComponent.sortOrder,
        isActive: input.isActive ?? existingComponent.isActive,
        updatedAt: new Date(),
      })
      .where(and(eq(salaryComponents.id, id), eq(salaryComponents.userId, userId)))
      .returning();

    return updated;
  },

  // Soft delete component
  delete: async (id: string, userId: string) => {
    const existingComponent = await db.query.salaryComponents.findFirst({
      where: and(
        eq(salaryComponents.id, id),
        eq(salaryComponents.userId, userId),
        isNull(salaryComponents.deletedAt)
      ),
    });

    if (!existingComponent) {
      return false;
    }

    await db
      .update(salaryComponents)
      .set({ deletedAt: new Date() })
      .where(and(eq(salaryComponents.id, id), eq(salaryComponents.userId, userId)));

    return true;
  },

  // Check if code exists
  codeExists: async (code: string, userId: string, excludeId?: string) => {
    const conditions = [
      eq(salaryComponents.code, code),
      eq(salaryComponents.userId, userId),
      isNull(salaryComponents.deletedAt),
    ];

    const component = await db.query.salaryComponents.findFirst({
      where: and(...conditions),
      columns: { id: true },
    });

    if (!component) return false;
    return excludeId ? component.id !== excludeId : true;
  },
};

export type EmployeeRepository = typeof employeeRepository;
export type EmployeeSalaryRepository = typeof employeeSalaryRepository;
export type SalaryComponentRepository = typeof salaryComponentRepository;
