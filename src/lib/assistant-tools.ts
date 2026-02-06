import { supabase } from '@/lib/supabase';
import { z } from 'zod';

// Helper to get the client (we can just return the imported one)
function getSupabase() {
    return supabase;
}

// --- SCHEMA DEFINITIONS ---

export const getDebtSummarySchema = z.object({});

export const getCashflowSchema = z.object({
    month: z.number().min(1).max(12).describe("The month number (1-12) to analyze"),
    year: z.number().describe("The year to analyze, e.g., 2024"),
});

export const getUpcomingPaymentsSchema = z.object({
    days: z.number().default(7).describe("Number of days to look ahead"),
});

export const markDebtPaidSchema = z.object({
    debtId: z.string().uuid().describe("The IDs of the debt to mark as paid"),
    paidAt: z.string().describe("ISO date string when it was paid"),
    amount: z.number().describe("Amount paid"),
    dryRun: z.boolean().default(true).describe("If true, only returns what would happen"),
});

export const updateDebtDueDateSchema = z.object({
    debtId: z.string().uuid(),
    newDueDate: z.string().describe("ISO date string for the new due date"),
    reason: z.string().describe("Reason for changing the date"),
    dryRun: z.boolean().default(true),
});

export const createExpenseSchema = z.object({
    amount: z.number(),
    category: z.string(),
    recipient: z.string().optional().describe("Who was paid"),
    note: z.string().optional(),
    date: z.string().describe("ISO date string"),
    dryRun: z.boolean().default(true),
});

export const createIncomeSchema = z.object({
    amount: z.number(),
    source: z.string(),
    category: z.string().optional(),
    note: z.string().optional(),
    date: z.string().describe("ISO date string"),
    dryRun: z.boolean().default(true),
});

export const getBudgetStatusSchema = z.object({
    month: z.number().optional().describe("Month to check (1-12). Defaults to current."),
    year: z.number().optional().describe("Year to check. Defaults to current."),
});

export const setBudgetLimitSchema = z.object({
    category: z.string().describe("Category name (e.g. 'Yemek', 'Kira')"),
    amount: z.number().describe("Monthly limit amount"),
    dryRun: z.boolean().default(true),
});

export const createDebtSchema = z.object({
    amount: z.number(),
    creditor: z.string().describe("Person or company to owe"),
    category: z.string().optional(),
    dueDate: z.string().describe("ISO date string for due date"),
    description: z.string().optional(),
    dryRun: z.boolean().default(true),
});

export const createInvoiceSchema = z.object({
    name: z.string().describe("Name of the invoice/expense"),
    provider: z.string().describe("Provider name (e.g. Enerjisa)"),
    amount: z.number(),
    dayOfMonth: z.number().min(1).max(31).describe("Day of month to repeat"),
    category: z.enum(['Enerji', 'Su', 'İletişim', 'Kira', 'Vergi', 'Diğer']),
    dryRun: z.boolean().default(true),
});

export const createSavingsGoalSchema = z.object({
    name: z.string(),
    targetAmount: z.number(),
    category: z.string().optional(),
    deadline: z.string().optional().describe("ISO date string"),
    dryRun: z.boolean().default(true),
});

export const updateSavingsAmountSchema = z.object({
    goalId: z.string().uuid(),
    amountToAdd: z.number().describe("Amount to add (positive) or remove (negative)"),
    dryRun: z.boolean().default(true),
});

export const getCalendarEventsSchema = z.object({
    startDate: z.string().describe("ISO date string (YYYY-MM-DD)"),
    endDate: z.string().describe("ISO date string (YYYY-MM-DD)"),
});

// --- TOOL IMPLEMENTATIONS ---

async function logAudit(actionType: string, entityId: string | null, before: any, after: any, reason: string) {
    const supabase = getSupabase();
    await supabase.from('audit_logs').insert({
        action_type: actionType,
        entity_id: entityId,
        before_state: before,
        after_state: after,
        reason: reason,
    });
}

export const tools = {
    getDebtSummary: async () => {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('debts')
            .select('*')
            .eq('status', 'Bekliyor')
            .order('due_date', { ascending: true });

        if (error) throw new Error(error.message);

        const totalDebt = data.reduce((sum, debt) => sum + Number(debt.amount), 0);
        const overdue = data.filter(d => new Date(d.due_date) < new Date());
        const upcoming = data.filter(d => {
            const diffTime = new Date(d.due_date).getTime() - new Date().getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays >= 0 && diffDays <= 7;
        });

        return {
            status: 'success',
            totalDebt,
            overdueCount: overdue.length,
            upcomingCount: upcoming.length,
            debts: data,
        };
    },

    getCashflow: async ({ month, year }: z.infer<typeof getCashflowSchema>) => {
        const supabase = getSupabase();
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];

        const [incomes, expenses] = await Promise.all([
            supabase.from('incomes').select('*').gte('date', startDate).lte('date', endDate),
            supabase.from('expenses').select('*').gte('date', startDate).lte('date', endDate)
        ]);

        if (incomes.error) throw new Error(incomes.error.message);
        if (expenses.error) throw new Error(expenses.error.message);

        const totalIncome = incomes.data.reduce((sum, i) => sum + Number(i.amount), 0);
        const totalExpense = expenses.data.reduce((sum, e) => sum + Number(e.amount), 0);

        return {
            status: 'success',
            period: `${month}/${year}`,
            totalIncome,
            totalExpense,
            net: totalIncome - totalExpense,
            details: {
                incomes: incomes.data,
                expenses: expenses.data
            }
        };
    },

    getUpcomingPayments: async ({ days }: z.infer<typeof getUpcomingPaymentsSchema>) => {
        const supabase = getSupabase();
        const today = new Date();
        const future = new Date();
        future.setDate(today.getDate() + days);

        const { data, error } = await supabase
            .from('debts')
            .select('*')
            .eq('status', 'Bekliyor')
            .lte('due_date', future.toISOString().split('T')[0])
            .gte('due_date', today.toISOString().split('T')[0]);

        if (error) throw new Error(error.message);

        return {
            status: 'success',
            daysLookingAhead: days,
            payments: data
        };
    },

    markDebtPaid: async ({ debtId, paidAt, amount, dryRun }: z.infer<typeof markDebtPaidSchema>) => {
        if (dryRun) {
            return {
                status: 'proposed',
                message: `PREVIEW: Mark debt ${debtId} as paid on ${paidAt} with amount ${amount}.`,
                action: 'markDebtPaid',
                params: { debtId, paidAt, amount }
            };
        }

        const supabase = getSupabase();
        const { data: beforeData } = await supabase.from('debts').select('*').eq('id', debtId).single();

        const { data, error } = await supabase
            .from('debts')
            .update({ status: 'Ödendi' })
            .eq('id', debtId)
            .select()
            .single();

        if (error) throw new Error(error.message);

        await logAudit('mark_debt_paid', debtId, beforeData, data, 'Marked as paid via AI Assistant');

        return {
            status: 'success',
            message: 'Debt marked as paid.',
            updatedRecord: data
        };
    },

    updateDebtDueDate: async ({ debtId, newDueDate, reason, dryRun }: z.infer<typeof updateDebtDueDateSchema>) => {
        if (dryRun) {
            return {
                status: 'proposed',
                message: `PREVIEW: Update due date for debt ${debtId} to ${newDueDate}. Reason: ${reason}`,
                action: 'updateDebtDueDate',
                params: { debtId, newDueDate, reason }
            };
        }

        const supabase = getSupabase();
        const { data: beforeData } = await supabase.from('debts').select('*').eq('id', debtId).single();

        const { data, error } = await supabase
            .from('debts')
            .update({ due_date: newDueDate })
            .eq('id', debtId)
            .select()
            .single();

        if (error) throw new Error(error.message);

        await logAudit('update_due_date', debtId, beforeData, data, reason);

        return {
            status: 'success',
            message: 'Due date updated.',
            updatedRecord: data
        };
    },

    createExpense: async ({ amount, category, recipient, note, date, dryRun }: z.infer<typeof createExpenseSchema>) => {
        if (dryRun) {
            return {
                status: 'proposed',
                message: `PREVIEW: Create expense of ${amount} for ${recipient || 'Unknown'} (${category}) on ${date}.`,
                action: 'createExpense',
                params: { amount, category, recipient, note, date }
            };
        }

        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('expenses')
            .insert({
                amount,
                category,
                recipient: recipient || 'Unknown',
                description: note,
                date,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw new Error(error.message);

        await logAudit('create_expense', data.id, null, data, 'Created via AI Assistant');

        return {
            status: 'success',
            message: 'Expense created successfully.',
            record: data
        };
    },

    createIncome: async ({ amount, source, category, note, date, dryRun }: z.infer<typeof createIncomeSchema>) => {
        if (dryRun) {
            return {
                status: 'proposed',
                message: `PREVIEW: Create income of ${amount} from ${source} (${category}) on ${date}.`,
                action: 'createIncome',
                params: { amount, source, category, note, date }
            };
        }

        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('incomes')
            .insert({
                amount,
                source,
                category: category || 'General',
                description: note,
                date,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw new Error(error.message);

        await logAudit('create_income', data.id, null, data, 'Created via AI Assistant');

        return {
            status: 'success',
            message: 'Income created successfully.',
            record: data
        };
    },

    getBudgetStatus: async ({ month, year }: z.infer<typeof getBudgetStatusSchema>) => {
        const supabase = getSupabase();
        const targetMonth = month || new Date().getMonth() + 1;
        const targetYear = year || new Date().getFullYear();

        const startDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
        const endDate = new Date(targetYear, targetMonth, 0).toISOString().split('T')[0];

        // Get expenses
        const { data: expenses, error: expError } = await supabase
            .from('expenses')
            .select('category, amount')
            .gte('date', startDate)
            .lte('date', endDate);

        if (expError) throw new Error(expError.message);

        // Get categories with limits
        const { data: categories, error: catError } = await supabase
            .from('categories')
            .select('name, monthly_limit')
            .gt('monthly_limit', 0); // Only those with limits

        if (catError) throw new Error(catError.message);

        // Calculate usage
        const usage = categories.map(cat => {
            const spent = expenses
                .filter(e => e.category === cat.name)
                .reduce((sum, e) => sum + Number(e.amount), 0);

            return {
                category: cat.name,
                limit: cat.monthly_limit,
                spent,
                remaining: Number(cat.monthly_limit) - spent,
                percentage: Math.round((spent / Number(cat.monthly_limit)) * 100)
            };
        });

        return {
            status: 'success',
            period: `${targetMonth}/${targetYear}`,
            budgets: usage
        };
    },

    setBudgetLimit: async ({ category, amount, dryRun }: z.infer<typeof setBudgetLimitSchema>) => {
        if (dryRun) {
            return {
                status: 'proposed',
                message: `PREVIEW: Set monthly budget limit for '${category}' to ${amount} TL.`,
                action: 'setBudgetLimit',
                params: { category, amount }
            };
        }

        const supabase = getSupabase();
        // Check if category exists
        const { data: existingCat } = await supabase.from('categories').select('*').eq('name', category).single();

        if (!existingCat) {
            // Create if not exists
            const { data, error } = await supabase.from('categories').upsert({
                name: category,
                type: 'expense',
                monthly_limit: amount
            }, { onConflict: 'name' }).select().single();
            if (error) throw new Error(error.message);

            await logAudit('set_budget', data.id, null, data, `Set budget for ${category}`);
            return { status: 'success', message: `Budget set for ${category}.`, record: data };
        }

        // Update
        const { data, error } = await supabase
            .from('categories')
            .update({ monthly_limit: amount })
            .eq('id', existingCat.id)
            .select()
            .single();

        if (error) throw new Error(error.message);
        await logAudit('set_budget', existingCat.id, existingCat, data, `Updated budget for ${category}`);

        return { status: 'success', message: `Budget updated for ${category}.`, record: data };
    },

    createDebt: async ({ amount, creditor, category, dueDate, description, dryRun }: z.infer<typeof createDebtSchema>) => {
        if (dryRun) {
            return {
                status: 'proposed',
                message: `PREVIEW: Create debt of ${amount} to ${creditor} due on ${dueDate}.`,
                action: 'createDebt',
                params: { amount, creditor, category, dueDate, description }
            };
        }

        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('debts')
            .insert({
                amount,
                creditor,
                category: category || 'Diğer',
                due_date: dueDate,
                description: description || '',
                created_date: new Date().toISOString(),
                status: 'Bekliyor'
            })
            .select()
            .single();

        if (error) throw new Error(error.message);
        await logAudit('create_debt', data.id, null, data, 'Created via AI Assistant');
        return { status: 'success', message: 'Debt created.', record: data };
    },

    createInvoice: async ({ name, provider, amount, dayOfMonth, category, dryRun }: z.infer<typeof createInvoiceSchema>) => {
        if (dryRun) {
            return {
                status: 'proposed',
                message: `PREVIEW: Create recurring invoice ${name} (${category}) of ${amount} TL on day ${dayOfMonth} of every month.`,
                action: 'createInvoice',
                params: { name, provider, amount, dayOfMonth, category }
            };
        }

        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('recurring_expenses')
            .insert({
                name,
                provider,
                amount,
                day_of_month: dayOfMonth,
                category,
                status: 'Bekliyor'
            })
            .select()
            .single();

        if (error) throw new Error(error.message);
        await logAudit('create_invoice', data.id, null, data, 'Created recurring invoice via AI');
        return { status: 'success', message: 'Invoice created.', record: data };
    },

    createSavingsGoal: async ({ name, targetAmount, category, deadline, dryRun }: z.infer<typeof createSavingsGoalSchema>) => {
        if (dryRun) {
            return {
                status: 'proposed',
                message: `PREVIEW: Create savings goal '${name}' for ${targetAmount} TL.`,
                action: 'createSavingsGoal',
                params: { name, targetAmount, category, deadline }
            };
        }

        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('savings')
            .insert({
                name,
                target_amount: targetAmount,
                current_amount: 0,
                category: category || 'Diğer',
                deadline: deadline || null,
                icon_color: 'blue'
            })
            .select()
            .single();

        if (error) throw new Error(error.message);
        await logAudit('create_savings', data.id, null, data, 'Created savings goal via AI');
        return { status: 'success', message: 'Savings goal created.', record: data };
    },

    updateSavingsAmount: async ({ goalId, amountToAdd, dryRun }: z.infer<typeof updateSavingsAmountSchema>) => {
        const supabase = getSupabase();

        // Fetch current to calculate new total
        const { data: current, error: fetchError } = await supabase.from('savings').select('current_amount, name').eq('id', goalId).single();
        if (fetchError) throw new Error(fetchError.message);

        const newAmount = Number(current.current_amount) + amountToAdd;

        if (dryRun) {
            return {
                status: 'proposed',
                message: `PREVIEW: Add ${amountToAdd} TL to '${current.name}'. New total: ${newAmount}.`,
                action: 'updateSavingsAmount',
                params: { goalId, amountToAdd }
            };
        }

        const { data, error } = await supabase
            .from('savings')
            .update({ current_amount: newAmount })
            .eq('id', goalId)
            .select()
            .single();

        if (error) throw new Error(error.message);
        await logAudit('update_savings', goalId, current, data, 'Updated savings amount via AI');
        return { status: 'success', message: 'Savings updated.', record: data };
    },

    getCalendarEvents: async ({ startDate, endDate }: z.infer<typeof getCalendarEventsSchema>) => {
        const supabase = getSupabase();

        const [incomes, expenses, debts, invoices] = await Promise.all([
            supabase.from('incomes').select('date, amount, source, category').gte('date', startDate).lte('date', endDate),
            supabase.from('expenses').select('date, amount, recipient, category').gte('date', startDate).lte('date', endDate),
            supabase.from('debts').select('due_date, amount, creditor').gte('due_date', startDate).lte('due_date', endDate),
            supabase.from('recurring_expenses').select('*')
        ]);

        // Transform recurring expenses to events in this range
        const recurringEvents = (invoices.data || []).flatMap((inv: any) => {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const events = [];
            let current = new Date(start.getFullYear(), start.getMonth(), inv.day_of_month);

            // Adjust if start day is after recurring day
            if (current < start) {
                current.setMonth(current.getMonth() + 1);
            }

            while (current <= end) {
                events.push({
                    date: current.toISOString().split('T')[0],
                    amount: inv.amount,
                    title: `${inv.name} (Fatura)`,
                    type: 'invoice'
                });
                current.setMonth(current.getMonth() + 1);
            }
            return events;
        });

        return {
            status: 'success',
            events: [
                ...(incomes.data?.map((i: any) => ({ ...i, type: 'income', title: i.source })) || []),
                ...(expenses.data?.map((e: any) => ({ ...e, type: 'expense', title: e.recipient })) || []),
                ...(debts.data?.map((d: any) => ({ date: d.due_date, amount: d.amount, title: d.creditor, type: 'debt' })) || []),
                ...recurringEvents
            ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        };
    }
};

// Map tools to OpenAI format
export const openAITools = [
    {
        type: "function",
        function: {
            name: "getDebtSummary",
            description: "Get a summary of all debts, including overdue and upcoming totals.",
            parameters: { type: "object", properties: {}, required: [] },
        },
    },
    {
        type: "function",
        function: {
            name: "getCashflow",
            description: "Get income and expense summary for a specific month.",
            parameters: {
                type: "object",
                properties: {
                    month: { type: "number", description: "Month number (1-12)" },
                    year: { type: "number", description: "Year (e.g. 2024)" }
                },
                required: ["month", "year"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "getUpcomingPayments",
            description: "Get payments due within X days",
            parameters: {
                type: "object",
                properties: {
                    days: { type: "number", description: "Number of days to look ahead (default 7)" }
                },
                required: ["days"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "markDebtPaid",
            description: "Mark a specific debt as paid.",
            parameters: {
                type: "object",
                properties: {
                    debtId: { type: "string", description: "UUID of the debt" },
                    paidAt: { type: "string", description: "ISO date string" },
                    amount: { type: "number", description: "Amount paid" },
                    dryRun: { type: "boolean", description: "If true, only proposes the change. Default true. Use false ONLY if user explicitly confirms." }
                },
                required: ["debtId", "paidAt", "amount"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "updateDebtDueDate",
            description: "Update the due date of a debt.",
            parameters: {
                type: "object",
                properties: {
                    debtId: { type: "string", description: "UUID of the debt" },
                    newDueDate: { type: "string", description: "New ISO date string" },
                    reason: { type: "string", description: "Reason for the change" },
                    dryRun: { type: "boolean", description: "Dry run flag" }
                },
                required: ["debtId", "newDueDate", "reason"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "createExpense",
            description: "Record a new expense.",
            parameters: {
                type: "object",
                properties: {
                    amount: { type: "number" },
                    category: { type: "string" },
                    recipient: { type: "string" },
                    note: { type: "string" },
                    date: { type: "string" },
                    dryRun: { type: "boolean" }
                },
                required: ["amount", "category", "date"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "createIncome",
            description: "Record a new income.",
            parameters: {
                type: "object",
                properties: {
                    amount: { type: "number" },
                    source: { type: "string" },
                    category: { type: "string" },
                    note: { type: "string" },
                    date: { type: "string" },
                    dryRun: { type: "boolean" }
                },
                required: ["amount", "source", "date"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "getBudgetStatus",
            description: "Get the status of budgets (spent vs limit) for the current month.",
            parameters: {
                type: "object",
                properties: {
                    month: { type: "number", description: "Month (1-12)" },
                    year: { type: "number" }
                },
                required: []
            }
        }
    },
    {
        type: "function",
        function: {
            name: "setBudgetLimit",
            description: "Set a monthly budget limit for a category.",
            parameters: {
                type: "object",
                properties: {
                    category: { type: "string", description: "Category name" },
                    amount: { type: "number", description: "Limit amount" },
                    dryRun: { type: "boolean" }
                },
                required: ["category", "amount"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "createDebt",
            description: "Record a new debt.",
            parameters: {
                type: "object",
                properties: {
                    amount: { type: "number" },
                    creditor: { type: "string" },
                    category: { type: "string" },
                    dueDate: { type: "string", description: "ISO date" },
                    description: { type: "string" },
                    dryRun: { type: "boolean" }
                },
                required: ["amount", "creditor", "dueDate"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "createInvoice",
            description: "Create a recurring invoice/expense.",
            parameters: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    provider: { type: "string" },
                    amount: { type: "number" },
                    dayOfMonth: { type: "number" },
                    category: { type: "string", enum: ['Enerji', 'Su', 'İletişim', 'Kira', 'Vergi', 'Diğer'] },
                    dryRun: { type: "boolean" }
                },
                required: ["name", "amount", "dayOfMonth", "category"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "createSavingsGoal",
            description: "Create a new savings goal.",
            parameters: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    targetAmount: { type: "number" },
                    category: { type: "string" },
                    deadline: { type: "string", description: "ISO date optional" },
                    dryRun: { type: "boolean" }
                },
                required: ["name", "targetAmount"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "updateSavingsAmount",
            description: "Add or remove money from a savings goal.",
            parameters: {
                type: "object",
                properties: {
                    goalId: { type: "string", description: "UUID of the goal" },
                    amountToAdd: { type: "number", description: "Positive to add, negative to remove" },
                    dryRun: { type: "boolean" }
                },
                required: ["goalId", "amountToAdd"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "getCalendarEvents",
            description: "Get financial events (incomes, expenses, debts, invoices) for a date range.",
            parameters: {
                type: "object",
                properties: {
                    startDate: { type: "string" },
                    endDate: { type: "string" }
                },
                required: ["startDate", "endDate"]
            }
        }
    }
];
