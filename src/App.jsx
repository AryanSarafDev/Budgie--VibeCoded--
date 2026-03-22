import { useEffect, useMemo, useRef, useState } from "react";
import logo from "./assets/Logo.png";

const PRIORITY_OPTIONS = [
  { label: "High", value: "high", weight: 3 },
  { label: "Medium", value: "medium", weight: 2 },
  { label: "Low", value: "low", weight: 1 }
];

const getPriorityWeight = (priority) => {
  const option = PRIORITY_OPTIONS.find((item) => item.value === priority);
  return option ? option.weight : 1;
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value);

const formatShortDate = (isoString) => {
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(parsed);
};

const formatLogTime = (isoString) => {
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown time";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(parsed);
};

function SalaryIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="icon-svg">
      <path d="M4 7.5h16a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M6.5 10.2h.01M17.5 13.8h.01" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function ExpenseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="icon-svg">
      <path d="M7 4.5h10v15H7z" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9.5 9h5M9.5 12h5M9.5 15h3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M9 4.5v-1h6v1" fill="none" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function SavingsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="icon-svg">
      <path d="M5 9.5h14v8.5H5z" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 9.5v-2a4 4 0 0 1 8 0v2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 12v3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function AiIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="icon-svg">
      <path d="M12 3.8l2.1 4.3 4.7.7-3.4 3.4.8 4.8-4.2-2.2-4.2 2.2.8-4.8-3.4-3.4 4.7-.7z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

const round2 = (value) => Math.round(value * 100) / 100;
const STORAGE_KEY = "saver-planner-state-v1";
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const AI_REQUEST_COOLDOWN_MS = 60000;
const LOG_STORAGE_LIMIT = 500;
const MAX_UNDO_STEPS = 40;
const LOG_LEVEL_OPTIONS = ["ALL", "INFO", "WARN", "ERROR"];
const LOG_TYPE_OPTIONS = ["ALL", "SYSTEM", "AI", "GOAL", "EXPENSE", "PURCHASE"];
const EXPENSE_HISTORY_TYPE_OPTIONS = ["ALL", "EXPENSE", "PURCHASE"];
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const buildDefaultExpenses = () => [];

const loadSavedState = () => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const parseJsonFromText = (text) => {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    // Continue with best-effort extraction.
  }

  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      // Continue.
    }
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      return null;
    }
  }

  return null;
};

const buildAiPrompt = ({ salary, monthlyExpenseTotal, monthlyPool, goals, monthsProcessed }) => {
  return `You are a financial planning assistant for a monthly savings app.\n\nInput data:\n- Monthly salary: ${salary}\n- Monthly total expenses: ${monthlyExpenseTotal}\n- Monthly savings pool: ${monthlyPool}\n- Months processed: ${monthsProcessed}\n- Goals: ${JSON.stringify(goals)}\n\nRules:\n- Be practical and concise.
- If fixed percentages are missing or weak, suggest improved percentages.
- Prioritize high-priority goals and nearly completed goals.
- Keep total suggested percentages at or below 100.
- Mention if the user is overspending relative to salary.
- Give actionable steps for the next 30 days.
\nReturn ONLY valid JSON in this exact shape:\n{\n  "summary": "string",\n  "recommendations": ["string"],\n  "suggestedPercents": [{"goalName": "string", "percent": number}],\n  "quickActions": ["string"],\n  "health": {"status": "healthy|watch|critical", "expenseRatioPct": number, "savingsRatePct": number},\n  "goalInsights": [{"goalName": "string", "remaining": number, "monthlyContribution": number, "etaMonths": number | null}]\n}`;
};

const sanitizeStatus = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "healthy" || normalized === "watch" || normalized === "critical") {
    return normalized;
  }
  return null;
};

const buildAdvisorEnhancements = ({ salary, monthlyExpenseTotal, monthlyPool, goals, suggestedPercents }) => {
  const safePool = Math.max(0, Number(monthlyPool) || 0);
  const safeSalary = Math.max(0, Number(salary) || 0);
  const safeExpense = Math.max(0, Number(monthlyExpenseTotal) || 0);

  const activeGoals = goals
    .map((goal) => {
      const target = Math.max(0, Number(goal?.target) || 0);
      const saved = Math.max(0, Number(goal?.saved) || 0);
      return {
        name: String(goal?.name || "Untitled Goal"),
        target,
        saved,
        remaining: Math.max(0, round2(target - saved)),
        priority: goal?.priority || "medium",
        currentPercent: Math.max(0, Math.min(100, Number(goal?.currentPercent ?? goal?.percent) || 0))
      };
    })
    .filter((goal) => goal.remaining > 0.01);

  const suggestionMap = new Map(
    (Array.isArray(suggestedPercents) ? suggestedPercents : [])
      .map((item) => ({
        goalName: String(item?.goalName || "").trim(),
        percent: Number(item?.percent)
      }))
      .filter((item) => item.goalName && Number.isFinite(item.percent) && item.percent >= 0)
      .map((item) => [item.goalName.toLowerCase(), Math.min(100, round2(item.percent))])
  );

  const totalSuggested = Array.from(suggestionMap.values()).reduce((sum, value) => sum + value, 0);
  const fallbackPercent =
    activeGoals.length > 0 && totalSuggested <= 0 ? round2(100 / activeGoals.length) : 0;

  const goalInsights = activeGoals
    .map((goal) => {
      const suggestedPercent = suggestionMap.get(goal.name.toLowerCase());
      const appliedPercent =
        Number.isFinite(suggestedPercent) && suggestedPercent >= 0
          ? suggestedPercent
          : goal.currentPercent > 0
            ? goal.currentPercent
            : fallbackPercent;

      const monthlyContribution = round2((safePool * appliedPercent) / 100);
      const etaMonths = monthlyContribution > 0.01 ? Math.ceil(goal.remaining / monthlyContribution) : null;

      return {
        goalName: goal.name,
        remaining: goal.remaining,
        suggestedPercent: round2(appliedPercent),
        monthlyContribution,
        etaMonths,
        priority: goal.priority
      };
    })
    .sort((a, b) => {
      const etaA = a.etaMonths == null ? Number.POSITIVE_INFINITY : a.etaMonths;
      const etaB = b.etaMonths == null ? Number.POSITIVE_INFINITY : b.etaMonths;
      return etaA - etaB;
    });

  const expenseRatio = safeSalary > 0 ? safeExpense / safeSalary : 1;
  const savingsRate = safeSalary > 0 ? safePool / safeSalary : 0;

  const healthStatus =
    safePool <= 0 || expenseRatio >= 0.9
      ? "critical"
      : expenseRatio >= 0.75 || savingsRate < 0.2
        ? "watch"
        : "healthy";

  const quickActions = [];
  if (safeSalary <= 0) {
    quickActions.push("Add your monthly salary so planning can estimate realistic timelines.");
  }
  if (safePool <= 0) {
    quickActions.push("Your monthly savings pool is zero. Cut variable expenses or increase salary before setting percentages.");
  }
  if (totalSuggested > 100.01) {
    quickActions.push("Suggested percentages exceed 100%. Trim lower-priority goals so allocation remains sustainable.");
  }

  const slowGoal = goalInsights.find((item) => item.etaMonths !== null && item.etaMonths > 18);
  if (slowGoal) {
    quickActions.push(`At current pace, ${slowGoal.goalName} may take ${slowGoal.etaMonths} months. Increase its monthly share.`);
  }

  const noEtaCount = goalInsights.filter((item) => item.etaMonths === null).length;
  if (noEtaCount > 0) {
    quickActions.push(`${noEtaCount} goal(s) have no timeline because projected monthly contribution is zero.`);
  }

  return {
    health: {
      status: healthStatus,
      expenseRatioPct: round2(expenseRatio * 100),
      savingsRatePct: round2(savingsRate * 100)
    },
    quickActions,
    goalInsights
  };
};

const mergeAdvisorResult = (result, context) => {
  const base = {
    source: String(result?.source || "local"),
    summary: String(result?.summary || "No summary generated."),
    recommendations: Array.isArray(result?.recommendations)
      ? result.recommendations.map((item) => String(item)).filter(Boolean)
      : [],
    suggestedPercents: Array.isArray(result?.suggestedPercents)
      ? result.suggestedPercents
          .map((item) => ({
            goalName: String(item?.goalName || ""),
            percent: Number(item?.percent)
          }))
          .filter((item) => item.goalName.trim().length > 0 && Number.isFinite(item.percent) && item.percent >= 0)
          .map((item) => ({ ...item, percent: round2(Math.min(100, item.percent)) }))
      : []
  };

  const computed = buildAdvisorEnhancements({
    ...context,
    suggestedPercents: base.suggestedPercents
  });

  const parsedHealth = result?.health && typeof result.health === "object"
    ? {
        status: sanitizeStatus(result.health.status),
        expenseRatioPct: Number(result.health.expenseRatioPct),
        savingsRatePct: Number(result.health.savingsRatePct)
      }
    : null;

  const normalizedGoalInsights = Array.isArray(result?.goalInsights)
    ? result.goalInsights
        .map((item) => ({
          goalName: String(item?.goalName || ""),
          remaining: Number(item?.remaining),
          monthlyContribution: Number(item?.monthlyContribution),
          etaMonths:
            item?.etaMonths === null || item?.etaMonths === undefined
              ? null
              : Math.max(0, Math.round(Number(item.etaMonths) || 0)),
          suggestedPercent: Number(item?.suggestedPercent)
        }))
        .filter((item) => item.goalName.trim().length > 0)
    : [];

  return {
    ...base,
    quickActions:
      Array.isArray(result?.quickActions) && result.quickActions.length > 0
        ? result.quickActions.map((item) => String(item)).filter(Boolean)
        : computed.quickActions,
    health: {
      status: parsedHealth?.status || computed.health.status,
      expenseRatioPct: Number.isFinite(parsedHealth?.expenseRatioPct)
        ? round2(parsedHealth.expenseRatioPct)
        : computed.health.expenseRatioPct,
      savingsRatePct: Number.isFinite(parsedHealth?.savingsRatePct)
        ? round2(parsedHealth.savingsRatePct)
        : computed.health.savingsRatePct
    },
    goalInsights: normalizedGoalInsights.length > 0
      ? normalizedGoalInsights.map((item) => ({
          ...item,
          remaining: Number.isFinite(item.remaining) ? round2(Math.max(0, item.remaining)) : 0,
          monthlyContribution: Number.isFinite(item.monthlyContribution)
            ? round2(Math.max(0, item.monthlyContribution))
            : 0,
          suggestedPercent: Number.isFinite(item.suggestedPercent)
            ? round2(Math.min(100, Math.max(0, item.suggestedPercent)))
            : null
        }))
      : computed.goalInsights
  };
};

const buildLocalAdvisorPlan = ({ salary, monthlyExpenseTotal, monthlyPool, goals }) => {
  const goalsWithNeed = goals
    .map((goal) => {
      const target = Number(goal.target) || 0;
      const saved = Number(goal.saved) || 0;
      const remaining = Math.max(0, round2(target - saved));
      const progress = target > 0 ? saved / target : 0;
      const priorityWeight = getPriorityWeight(goal.priority);
      const finishSoonBonus = remaining > 0 && remaining <= monthlyPool ? 0.7 : 0;
      const score =
        remaining > 0 ? priorityWeight * (1 + (1 - Math.min(1, progress)) * 0.6 + finishSoonBonus) : 0;

      return {
        ...goal,
        remaining,
        score
      };
    })
    .filter((goal) => goal.remaining > 0.01);

  const totalScore = goalsWithNeed.reduce((sum, goal) => sum + goal.score, 0);
  const suggestedPercents =
    totalScore > 0
      ? goalsWithNeed.map((goal, index) => {
          const raw = (goal.score / totalScore) * 100;
          const percent = index === goalsWithNeed.length - 1 ? null : round2(raw);
          return { goalName: goal.name, percent };
        })
      : [];

  if (suggestedPercents.length > 0) {
    const used = suggestedPercents
      .slice(0, -1)
      .reduce((sum, item) => sum + (item.percent || 0), 0);
    const last = suggestedPercents[suggestedPercents.length - 1];
    last.percent = round2(Math.max(0, 100 - used));
  }

  const expenseRatio = salary > 0 ? monthlyExpenseTotal / salary : 1;
  const recommendations = [];

  if (expenseRatio >= 0.8) {
    recommendations.push("Expenses are above 80% of salary. Reduce variable expenses to grow savings faster.");
  } else if (expenseRatio >= 0.65) {
    recommendations.push("Expenses are moderate-high. A small monthly cut can significantly improve goal timelines.");
  } else {
    recommendations.push("Expense ratio is healthy. Continue consistent monthly processing for faster compounding.");
  }

  if (goalsWithNeed.length > 0) {
    const top = goalsWithNeed
      .slice()
      .sort((a, b) => b.score - a.score)[0];
    recommendations.push(`Prioritize ${top.name} for faster momentum while keeping other goals funded.`);
  }

  if (monthlyPool <= 0) {
    recommendations.push("Current monthly pool is zero. Raise salary or reduce expenses before distributing percentages.");
  }

  const summary =
    monthlyPool > 0
      ? `Local smart plan generated for ${goalsWithNeed.length} active goals using priority and remaining-amount weighting.`
      : "Local smart plan generated, but your monthly savings pool is currently zero.";

  return mergeAdvisorResult({
    source: "local",
    summary,
    recommendations,
    suggestedPercents
  }, {
    salary,
    monthlyExpenseTotal,
    monthlyPool,
    goals
  });
};

const getApiErrorDetails = (errorBody) => {
  const parsed = parseJsonFromText(errorBody);
  const message = parsed?.error?.message || "Gemini request failed.";
  const retryDelay =
    parsed?.error?.details?.find((item) => item?.["@type"]?.includes("RetryInfo"))?.retryDelay || "";
  return {
    message,
    retryDelay
  };
};

const retryDelayToMs = (retryDelay) => {
  if (!retryDelay) {
    return 0;
  }

  const normalized = String(retryDelay).trim().toLowerCase();
  if (normalized.endsWith("s")) {
    const seconds = Number.parseFloat(normalized.slice(0, -1));
    return Number.isFinite(seconds) ? Math.max(0, Math.ceil(seconds * 1000)) : 0;
  }

  const numeric = Number.parseFloat(normalized);
  return Number.isFinite(numeric) ? Math.max(0, Math.ceil(numeric)) : 0;
};

const normalizeGoal = (goal) => {
  const target = Number(goal?.target);
  const saved = Number(goal?.saved);
  const percent = Number(goal?.percent);
  const safeTarget = Number.isFinite(target) && target > 0 ? target : 0;
  const safeSaved = Number.isFinite(saved) && saved > 0 ? Math.min(saved, safeTarget) : 0;
  const safePercent = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;

  return {
    id: goal?.id || crypto.randomUUID(),
    name: String(goal?.name || "Untitled Goal"),
    target: round2(safeTarget),
    saved: round2(safeSaved),
    priority: goal?.priority || "medium",
    percent: round2(safePercent)
  };
};

const toMonthKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const shiftMonthKey = (monthKey, delta) => {
  const [yearRaw, monthRaw] = String(monthKey || "").split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return toMonthKey(new Date());
  }

  const base = new Date(year, month - 1 + delta, 1);
  return toMonthKey(base);
};

const allocateByWeight = (amount, candidates, map, remainingById) => {
  let remainder = round2(amount);
  let guard = 0;

  while (remainder > 0.01 && guard < 12) {
    const available = candidates.filter((item) => (remainingById.get(item.id) || 0) > 0.01);
    if (available.length === 0) {
      break;
    }

    const totalWeight = available.reduce(
      (sum, item) => sum + getPriorityWeight(item.priority),
      0
    );
    if (totalWeight <= 0) {
      break;
    }

    let distributed = 0;
    const snapshot = remainder;

    available.forEach((item, index) => {
      const need = remainingById.get(item.id) || 0;
      if (need <= 0.01) {
        return;
      }

      const rawShare = (snapshot * getPriorityWeight(item.priority)) / totalWeight;
      const share = index === available.length - 1 ? snapshot - distributed : round2(rawShare);
      const grant = round2(Math.min(need, share));

      if (grant > 0) {
        map.set(item.id, round2((map.get(item.id) || 0) + grant));
        remainingById.set(item.id, round2(need - grant));
        distributed += grant;
      }
    });

    if (distributed <= 0) {
      break;
    }

    remainder = round2(remainder - distributed);
    guard += 1;
  }

  return remainder;
};

function calculateAllocation(pool, items) {
  const activeItems = items
    .map(normalizeGoal)
    .filter((item) => item.target > item.saved + 0.01);

  if (pool <= 0 || activeItems.length === 0) {
    return {
      allocationMap: new Map(),
      unassigned: pool > 0 ? pool : 0,
      meta: {
        fixedPercentInput: 0,
        fixedPercentApplied: 0,
        scalingApplied: false
      }
    };
  }

  const map = new Map();
  const remainingById = new Map(
    activeItems.map((item) => [item.id, round2(item.target - item.saved)])
  );
  let unassigned = round2(pool);

  const fixedItems = activeItems.filter((item) => item.percent > 0);

  const fixedTotalPercent = fixedItems.reduce(
    (sum, item) => sum + Math.min(100, Math.max(0, item.percent)),
    0
  );
  const fixedScale = fixedTotalPercent > 100 ? 100 / fixedTotalPercent : 1;
  const fixedApplied = fixedTotalPercent * fixedScale;

  fixedItems.forEach((item) => {
    const need = remainingById.get(item.id) || 0;
    const share = (Math.min(100, Math.max(0, item.percent)) * fixedScale) / 100;
    const proposed = round2(pool * share);
    const amount = round2(Math.min(need, proposed));

    if (amount > 0) {
      map.set(item.id, round2((map.get(item.id) || 0) + amount));
      remainingById.set(item.id, round2(need - amount));
      unassigned = round2(unassigned - amount);
    }
  });

  if (unassigned > 0.01) {
    unassigned = allocateByWeight(unassigned, activeItems, map, remainingById);
  }

  return {
    allocationMap: map,
    unassigned: Math.max(0, round2(unassigned)),
    meta: {
      fixedPercentInput: round2(fixedTotalPercent),
      fixedPercentApplied: round2(fixedApplied),
      scalingApplied: fixedTotalPercent > 100
    }
  };
}

export default function App() {
  const [savedState] = useState(() => loadSavedState());
  const [salary, setSalary] = useState(() =>
    typeof savedState?.salary === "number" ? savedState.salary : 0
  );
  const [expenses, setExpenses] = useState(() =>
    Array.isArray(savedState?.expenses) && savedState.expenses.length > 0
      ? savedState.expenses
      : buildDefaultExpenses()
  );
  const [expenseForm, setExpenseForm] = useState({
    name: "",
    amount: ""
  });
  const [dailySpendForm, setDailySpendForm] = useState(() => ({
    date: new Date().toISOString().slice(0, 10),
    amount: "",
    note: ""
  }));
  const [dailySpendError, setDailySpendError] = useState("");
  const [monthsProcessed, setMonthsProcessed] = useState(() =>
    typeof savedState?.monthsProcessed === "number" ? savedState.monthsProcessed : 0
  );
  const [monthPoolSpent, setMonthPoolSpent] = useState(() =>
    typeof savedState?.monthPoolSpent === "number" ? savedState.monthPoolSpent : 0
  );
  const [extraSavings, setExtraSavings] = useState(() =>
    typeof savedState?.extraSavings === "number" ? savedState.extraSavings : 0
  );
  const [spentOnPurchases, setSpentOnPurchases] = useState(() =>
    typeof savedState?.spentOnPurchases === "number" ? savedState.spentOnPurchases : 0
  );
  const [purchaseHistory, setPurchaseHistory] = useState(() =>
    Array.isArray(savedState?.purchaseHistory) ? savedState.purchaseHistory : []
  );
  const [items, setItems] = useState(() =>
    Array.isArray(savedState?.items) ? savedState.items.map(normalizeGoal) : []
  );
  const [form, setForm] = useState({
    name: "",
    target: "",
    priority: "medium",
    percent: ""
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiResult, setAiResult] = useState(null);
  const [aiRawText, setAiRawText] = useState("");
  const [logs, setLogs] = useState(() =>
    Array.isArray(savedState?.logs) ? savedState.logs : []
  );
  const [expenseTypeFilter, setExpenseTypeFilter] = useState("ALL");
  const [expenseMonthFilter, setExpenseMonthFilter] = useState("ALL");
  const [expenseSearch, setExpenseSearch] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(() => toMonthKey(new Date()));
  const [activePage, setActivePage] = useState("planner");
  const [undoDepth, setUndoDepth] = useState(0);
  const aiRequestLockRef = useRef(false);
  const lastAiRequestAtRef = useRef(0);
  const geminiBlockedUntilRef = useRef(0);
  const undoStackRef = useRef([]);

  const buildUndoSnapshot = () => ({
    salary,
    expenses,
    expenseForm,
    dailySpendForm,
    dailySpendError,
    monthsProcessed,
    monthPoolSpent,
    extraSavings,
    spentOnPurchases,
    purchaseHistory,
    items,
    form,
    aiError,
    aiResult,
    aiRawText,
    logs,
    expenseTypeFilter,
    expenseMonthFilter,
    expenseSearch,
    calendarMonth,
    activePage
  });

  const pushUndoSnapshot = (label) => {
    const next = [...undoStackRef.current, { label, snapshot: buildUndoSnapshot() }].slice(-MAX_UNDO_STEPS);
    undoStackRef.current = next;
    setUndoDepth(next.length);
  };

  const restoreSnapshot = (snapshot) => {
    setSalary(snapshot.salary);
    setExpenses(snapshot.expenses);
    setExpenseForm(snapshot.expenseForm);
    setDailySpendForm(snapshot.dailySpendForm);
    setDailySpendError(snapshot.dailySpendError);
    setMonthsProcessed(snapshot.monthsProcessed);
    setMonthPoolSpent(snapshot.monthPoolSpent);
    setExtraSavings(snapshot.extraSavings);
    setSpentOnPurchases(snapshot.spentOnPurchases);
    setPurchaseHistory(snapshot.purchaseHistory);
    setItems(snapshot.items);
    setForm(snapshot.form);
    setAiLoading(false);
    setAiError(snapshot.aiError);
    setAiResult(snapshot.aiResult);
    setAiRawText(snapshot.aiRawText);
    setLogs(snapshot.logs);
    setExpenseTypeFilter(snapshot.expenseTypeFilter);
    setExpenseMonthFilter(snapshot.expenseMonthFilter);
    setExpenseSearch(snapshot.expenseSearch);
    setCalendarMonth(snapshot.calendarMonth);
    setActivePage(snapshot.activePage);
    aiRequestLockRef.current = false;
    lastAiRequestAtRef.current = 0;
    geminiBlockedUntilRef.current = 0;
  };

  const undoLastAction = () => {
    if (undoStackRef.current.length === 0) {
      return;
    }
    const next = [...undoStackRef.current];
    const latest = next.pop();
    undoStackRef.current = next;
    setUndoDepth(next.length);
    restoreSnapshot(latest.snapshot);
  };

  const addLog = ({ type, level, message, meta = null }) => {
    const safeType = LOG_TYPE_OPTIONS.includes(type) ? type : "SYSTEM";
    const safeLevel = LOG_LEVEL_OPTIONS.includes(level) ? level : "INFO";

    setLogs((current) => [
      {
        id: crypto.randomUUID(),
        ts: new Date().toISOString(),
        type: safeType,
        level: safeLevel,
        message: String(message),
        meta
      },
      ...current
    ].slice(0, LOG_STORAGE_LIMIT));
  };

  const monthlyExpenseTotal = useMemo(
    () => expenses.reduce((sum, expense) => sum + expense.amount, 0),
    [expenses]
  );

  const monthlyPool = useMemo(
    () => Math.max(0, salary - monthlyExpenseTotal),
    [salary, monthlyExpenseTotal]
  );

  const availableMonthExcess = useMemo(
    () => Math.max(0, round2(monthlyPool - monthPoolSpent)),
    [monthlyPool, monthPoolSpent]
  );

  const effectivePlanningPool = useMemo(
    () => Math.max(0, round2(availableMonthExcess)),
    [availableMonthExcess]
  );

  const allocationSnapshot = useMemo(
    () => calculateAllocation(effectivePlanningPool, items),
    [effectivePlanningPool, items]
  );

  const plannedAllocation = useMemo(() => {
    return items.map((item) => ({
      id: item.id,
      amount: allocationSnapshot.allocationMap.get(item.id) || 0
    }));
  }, [items, allocationSnapshot]);

  const addItem = (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.target) {
      addLog({
        type: "GOAL",
        level: "WARN",
        message: "Goal creation blocked due to missing fields."
      });
      return;
    }

    const targetValue = Number(form.target);
    if (Number.isNaN(targetValue) || targetValue <= 0) {
      addLog({
        type: "GOAL",
        level: "WARN",
        message: "Goal creation blocked due to invalid target amount.",
        meta: { target: form.target }
      });
      return;
    }

    const percentValue = Number(form.percent || 0);
    const nextItem = {
      id: crypto.randomUUID(),
      name: form.name.trim(),
      target: targetValue,
      priority: form.priority,
      percent:
        Number.isFinite(percentValue) && percentValue > 0
          ? round2(Math.min(100, percentValue))
          : 0,
      saved: 0
    };

    pushUndoSnapshot("Add goal");
    setItems((current) => [...current, nextItem]);
    setForm({ name: "", target: "", priority: "medium", percent: "" });
    addLog({
      type: "GOAL",
      level: "INFO",
      message: `Goal created: ${nextItem.name}`,
      meta: { target: nextItem.target, priority: nextItem.priority, percent: nextItem.percent }
    });
  };

  const addExpense = (event) => {
    event.preventDefault();
    if (!expenseForm.name.trim() || !expenseForm.amount) {
      addLog({
        type: "EXPENSE",
        level: "WARN",
        message: "Expense creation blocked due to missing fields."
      });
      return;
    }

    const amountValue = Number(expenseForm.amount);
    if (Number.isNaN(amountValue) || amountValue <= 0) {
      addLog({
        type: "EXPENSE",
        level: "WARN",
        message: "Expense creation blocked due to invalid amount.",
        meta: { amount: expenseForm.amount }
      });
      return;
    }

    pushUndoSnapshot("Add expense");
    setExpenses((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: expenseForm.name.trim(),
        amount: amountValue
      }
    ]);
    addLog({
      type: "EXPENSE",
      level: "INFO",
      message: `Expense added: ${expenseForm.name.trim()}`,
      meta: { amount: amountValue }
    });
    setExpenseForm({ name: "", amount: "" });
  };

  const removeExpense = (id) => {
    const target = expenses.find((expense) => expense.id === id);
    pushUndoSnapshot("Remove expense");
    setExpenses((current) => current.filter((expense) => expense.id !== id));
    addLog({
      type: "EXPENSE",
      level: "INFO",
      message: `Expense removed${target ? `: ${target.name}` : ""}.`,
      meta: { amount: target?.amount || 0 }
    });
  };

  const addDailySpending = (event) => {
    event.preventDefault();
    setDailySpendError("");

    const amountValue = Number(dailySpendForm.amount);
    if (!dailySpendForm.date || Number.isNaN(new Date(dailySpendForm.date).getTime())) {
      setDailySpendError("Choose a valid date.");
      return;
    }

    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setDailySpendError("Enter a valid spending amount.");
      return;
    }

    const availableSavingsNow = round2(extraSavings + availableMonthExcess);
    if (amountValue > availableSavingsNow + 0.01) {
      setDailySpendError("Not enough savings available for this daily spend entry.");
      return;
    }

    pushUndoSnapshot("Add daily spending");
    let remaining = round2(amountValue);
    const fromCurrentExcess = Math.min(availableMonthExcess, remaining);
    if (fromCurrentExcess > 0) {
      setMonthPoolSpent((value) => round2(value + fromCurrentExcess));
      remaining = round2(remaining - fromCurrentExcess);
    }

    if (remaining > 0) {
      setExtraSavings((value) => round2(Math.max(0, value - remaining)));
    }

    const note = dailySpendForm.note.trim();
    const dateLabel = formatShortDate(dailySpendForm.date);

    addLog({
      type: "EXPENSE",
      level: "INFO",
      message: `Daily spend logged: ${note || "General"} (${dateLabel})`,
      meta: {
        amount: round2(amountValue),
        source: "DAILY_SPEND",
        spendDate: dailySpendForm.date,
        note: note || null
      }
    });

    setDailySpendForm((current) => ({
      ...current,
      amount: "",
      note: ""
    }));
  };

  const processMonth = () => {
    pushUndoSnapshot("Process month");
    addLog({
      type: "SYSTEM",
      level: "INFO",
      message: "Monthly processing started.",
      meta: { pool: effectivePlanningPool, goals: items.length }
    });
    const { allocationMap, unassigned } = calculateAllocation(effectivePlanningPool, items);

    let overflow = 0;
    const nextItems = items.map((item) => {
      const allocation = allocationMap.get(item.id) || 0;
      if (allocation <= 0) {
        return item;
      }

      const nextSaved = item.saved + allocation;
      if (nextSaved > item.target) {
        overflow += nextSaved - item.target;
      }

      return {
        ...item,
        saved: round2(Math.min(item.target, nextSaved))
      };
    });

    setItems(nextItems);
    setMonthsProcessed((count) => count + 1);
    setExtraSavings((value) => round2(value + unassigned + overflow));
    setMonthPoolSpent(0);
    addLog({
      type: "SYSTEM",
      level: "INFO",
      message: "Monthly processing completed.",
      meta: { unassigned, overflow, processedGoals: nextItems.length }
    });
  };

  const removeItem = (id) => {
    const target = items.find((item) => item.id === id);
    pushUndoSnapshot("Remove goal");
    setItems((current) => current.filter((item) => item.id !== id));
    addLog({
      type: "GOAL",
      level: "INFO",
      message: `Goal removed${target ? `: ${target.name}` : ""}.`
    });
  };

  const buyItem = (id) => {
    const goal = items.find((item) => item.id === id);
    if (!goal) {
      return;
    }

    const remainingToFund = round2(Math.max(0, goal.target - goal.saved));
    const availableInstant = round2(extraSavings + availableMonthExcess);
    if (availableInstant + 0.01 < remainingToFund) {
      setAiError("Not enough available savings to buy this goal yet.");
      addLog({
        type: "PURCHASE",
        level: "WARN",
        message: `Purchase blocked for ${goal.name}.`,
        meta: { needed: remainingToFund, available: availableInstant }
      });
      return;
    }

    pushUndoSnapshot("Buy goal");

    if (remainingToFund > 0) {
      let stillNeeded = remainingToFund;

      const useFromExtra = Math.min(extraSavings, stillNeeded);
      stillNeeded = round2(stillNeeded - useFromExtra);
      if (useFromExtra > 0) {
        setExtraSavings((value) => round2(Math.max(0, value - useFromExtra)));
      }

      if (stillNeeded > 0) {
        setMonthPoolSpent((value) => round2(value + stillNeeded));
      }
    }

    setSpentOnPurchases((value) => round2(value + goal.target));
    setPurchaseHistory((current) => [
      {
        id: crypto.randomUUID(),
        goalName: goal.name,
        amount: goal.target,
        purchasedAt: new Date().toISOString()
      },
      ...current
    ]);
    setItems((current) => current.filter((item) => item.id !== id));
    addLog({
      type: "PURCHASE",
      level: "INFO",
      message: `Goal purchased: ${goal.name}`,
      meta: { amount: goal.target, usedFromExtra: Math.min(extraSavings, remainingToFund) }
    });
  };

  const resetProgress = () => {
    pushUndoSnapshot("Reset progress");
    setItems((current) => current.map((item) => ({ ...item, saved: 0 })));
    setMonthsProcessed(0);
    setMonthPoolSpent(0);
    setExtraSavings(0);
    setSpentOnPurchases(0);
    setPurchaseHistory([]);
    addLog({
      type: "SYSTEM",
      level: "INFO",
      message: "Progress reset for goals, purchases, and monthly counters."
    });
  };

  const hardResetApp = () => {
    const confirmed = window.confirm("This will erase all saved Budgie data. Continue?");
    if (!confirmed) {
      return;
    }

    pushUndoSnapshot("Hard reset");
    localStorage.removeItem(STORAGE_KEY);

    setSalary(0);
    setExpenses(buildDefaultExpenses());
    setExpenseForm({ name: "", amount: "" });
    setDailySpendForm({
      date: new Date().toISOString().slice(0, 10),
      amount: "",
      note: ""
    });
    setDailySpendError("");
    setMonthsProcessed(0);
    setMonthPoolSpent(0);
    setExtraSavings(0);
    setSpentOnPurchases(0);
    setPurchaseHistory([]);
    setItems([]);
    setForm({
      name: "",
      target: "",
      priority: "medium",
      percent: ""
    });
    setAiLoading(false);
    setAiError("");
    setAiResult(null);
    setAiRawText("");
    setLogs([]);
    setExpenseTypeFilter("ALL");
    setExpenseMonthFilter("ALL");
    setExpenseSearch("");
    setCalendarMonth(toMonthKey(new Date()));
    setActivePage("planner");

    aiRequestLockRef.current = false;
    lastAiRequestAtRef.current = 0;
    geminiBlockedUntilRef.current = 0;
  };

  const runAiAdvisor = async () => {
    if (aiRequestLockRef.current) {
      addLog({
        type: "AI",
        level: "WARN",
        message: "AI request blocked because another AI call is already running."
      });
      return;
    }

    const now = Date.now();
    const goalContext = items.map((item) => ({
      name: item.name,
      target: item.target,
      saved: item.saved,
      priority: item.priority,
      currentPercent: item.percent,
      monthlyAllocation: plannedAllocation.find((entry) => entry.id === item.id)?.amount || 0
    }));

    const elapsedSinceLast = now - lastAiRequestAtRef.current;
    if (lastAiRequestAtRef.current > 0 && elapsedSinceLast < AI_REQUEST_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((AI_REQUEST_COOLDOWN_MS - elapsedSinceLast) / 1000);
      const fallback = buildLocalAdvisorPlan({
        salary,
        monthlyExpenseTotal,
        monthlyPool: effectivePlanningPool,
        goals: goalContext
      });
      setAiResult(fallback);
      setAiError(`Please wait ${waitSeconds}s before generating another AI plan. Showing local smart plan meanwhile.`);
      addLog({
        type: "AI",
        level: "WARN",
        message: "AI request blocked by cooldown.",
        meta: { waitSeconds }
      });
      return;
    }

    if (!GEMINI_API_KEY) {
      const fallback = buildLocalAdvisorPlan({
        salary,
        monthlyExpenseTotal,
        monthlyPool: effectivePlanningPool,
        goals: goalContext
      });
      setAiResult(fallback);
      setAiError("Missing API key. Using local smart plan. Add VITE_GEMINI_API_KEY in your .env file to enable Gemini insights.");
      addLog({
        type: "AI",
        level: "WARN",
        message: "AI request used local smart plan because API key is missing."
      });
      return;
    }

    if (now < geminiBlockedUntilRef.current) {
      const waitSeconds = Math.ceil((geminiBlockedUntilRef.current - now) / 1000);
      const fallback = buildLocalAdvisorPlan({
        salary,
        monthlyExpenseTotal,
        monthlyPool: effectivePlanningPool,
        goals: goalContext
      });
      setAiResult(fallback);
      setAiError(`Gemini is rate-limited right now. Using local smart plan for ${waitSeconds}s.`);
      addLog({
        type: "AI",
        level: "WARN",
        message: "AI request skipped due to active rate-limit backoff.",
        meta: { waitSeconds }
      });
      return;
    }

    aiRequestLockRef.current = true;
    lastAiRequestAtRef.current = now;
    setAiLoading(true);
    setAiError("");
    addLog({
      type: "AI",
      level: "INFO",
      message: "AI analysis request started.",
      meta: { model: GEMINI_MODEL, goals: goalContext.length }
    });

    try {
      const prompt = buildAiPrompt({
        salary,
        monthlyExpenseTotal,
        monthlyPool: effectivePlanningPool,
        goals: goalContext,
        monthsProcessed
      });

      const response = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            responseMimeType: "application/json"
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        const { message, retryDelay } = getApiErrorDetails(errorText);

        if (response.status === 429) {
          const retryMs = retryDelayToMs(retryDelay);
          const blockMs = Math.max(retryMs, 10 * 1000);
          geminiBlockedUntilRef.current = Date.now() + blockMs;

          const fallback = buildLocalAdvisorPlan({
            salary,
            monthlyExpenseTotal,
            monthlyPool: effectivePlanningPool,
            goals: goalContext
          });
          setAiResult(fallback);
          setAiRawText(errorText);
          setAiError(
            `Gemini quota exceeded. Using local smart plan${blockMs > 0 ? ` for ${Math.ceil(blockMs / 1000)}s` : ""}.`
          );
          addLog({
            type: "AI",
            level: "WARN",
            message: "Gemini quota exceeded; switched to local smart plan.",
            meta: { retryDelay, blockMs }
          });
          return;
        }

        throw new Error(message || "Gemini request failed.");
      }

      const data = await response.json();
      const text =
        data?.candidates?.[0]?.content?.parts
          ?.map((part) => part?.text || "")
          .join("\n")
          .trim() || "";

      if (!text) {
        throw new Error("Gemini returned an empty response.");
      }

      setAiRawText(text);

      const parsed = parseJsonFromText(text);
      if (!parsed || typeof parsed !== "object") {
        const fallback = buildLocalAdvisorPlan({
          salary,
          monthlyExpenseTotal,
          monthlyPool: effectivePlanningPool,
          goals: goalContext
        });
        setAiResult(fallback);
        setAiError("Could not parse structured AI output. Showing local smart plan and raw response below.");
        addLog({
          type: "AI",
          level: "ERROR",
          message: "Gemini response parse failed."
        });
        return;
      }

      const nextResult = mergeAdvisorResult({
        source: "gemini",
        summary: String(parsed.summary || "No summary generated."),
        recommendations: Array.isArray(parsed.recommendations)
          ? parsed.recommendations.map((item) => String(item))
          : [],
        suggestedPercents: Array.isArray(parsed.suggestedPercents)
          ? parsed.suggestedPercents
              .map((item) => ({
                goalName: String(item.goalName || ""),
                percent: Number(item.percent)
              }))
              .filter(
                (item) =>
                  item.goalName.trim().length > 0 && Number.isFinite(item.percent) && item.percent >= 0
              )
              .map((item) => ({ ...item, percent: round2(Math.min(100, item.percent)) }))
          : [],
        quickActions: Array.isArray(parsed.quickActions)
          ? parsed.quickActions.map((item) => String(item))
          : [],
        health: parsed.health,
        goalInsights: Array.isArray(parsed.goalInsights) ? parsed.goalInsights : []
      }, {
        salary,
        monthlyExpenseTotal,
        monthlyPool: effectivePlanningPool,
        goals: goalContext
      });

      setAiResult(nextResult);
      addLog({
        type: "AI",
        level: "INFO",
        message: "AI analysis completed successfully.",
        meta: { source: nextResult.source, suggestions: nextResult.suggestedPercents.length }
      });
    } catch (error) {
      const fallback = buildLocalAdvisorPlan({
        salary,
        monthlyExpenseTotal,
        monthlyPool: effectivePlanningPool,
        goals: items
      });
      setAiResult(fallback);
      const message = error instanceof Error ? error.message : "Unexpected AI error.";
      setAiError(`${message} Showing local smart plan instead.`);
      addLog({
        type: "AI",
        level: "ERROR",
        message: "AI request failed; local fallback used.",
        meta: { error: message }
      });
    } finally {
      aiRequestLockRef.current = false;
      setAiLoading(false);
    }
  };

  const applyAiPercentSuggestions = () => {
    if (!aiResult?.suggestedPercents?.length) {
      addLog({
        type: "AI",
        level: "WARN",
        message: "Apply suggestions ignored because no AI suggestions exist."
      });
      return;
    }

    pushUndoSnapshot("Apply AI suggestions");
    const byName = new Map(
      aiResult.suggestedPercents.map((item) => [item.goalName.trim().toLowerCase(), item.percent])
    );

    setItems((current) =>
      current.map((item) => {
        const key = item.name.trim().toLowerCase();
        if (!byName.has(key)) {
          return item;
        }

        return {
          ...item,
          percent: round2(Math.min(100, Math.max(0, byName.get(key) || 0)))
        };
      })
    );
    addLog({
      type: "AI",
      level: "INFO",
      message: "AI suggested percentages applied to matching goals.",
      meta: { count: aiResult.suggestedPercents.length }
    });
  };

  const totalItemSavings = items.reduce((sum, item) => sum + item.saved, 0);
  const totalSavings = round2(totalItemSavings + extraSavings);
  const totalSavingsWithCurrentExcess = round2(totalSavings + availableMonthExcess);

  const expenseHistory = useMemo(
    () => logs.filter((entry) => entry.type === "EXPENSE" || entry.type === "PURCHASE"),
    [logs]
  );

  const dailySpendEntries = useMemo(() => {
    const output = [];

    expenseHistory.forEach((entry) => {
      const amount = Number(entry?.meta?.amount || 0);
      if (!Number.isFinite(amount) || amount <= 0) {
        return;
      }

      if (entry.type === "PURCHASE") {
        const dateKey = String(entry.ts || "").slice(0, 10);
        if (dateKey.length === 10) {
          output.push({
            id: entry.id,
            dateKey,
            amount: round2(amount),
            kind: "purchase"
          });
        }
        return;
      }

      if (entry.type === "EXPENSE" && entry?.meta?.source === "DAILY_SPEND") {
        const dateKey =
          typeof entry?.meta?.spendDate === "string" && entry.meta.spendDate.length === 10
            ? entry.meta.spendDate
            : String(entry.ts || "").slice(0, 10);

        if (dateKey.length === 10) {
          output.push({
            id: entry.id,
            dateKey,
            amount: round2(amount),
            kind: "daily"
          });
        }
      }
    });

    return output;
  }, [expenseHistory]);

  const todaySpendTotal = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    return round2(
      dailySpendEntries
        .filter((entry) => entry.dateKey === todayKey)
        .reduce((sum, entry) => sum + entry.amount, 0)
    );
  }, [dailySpendEntries]);

  const calendarSnapshot = useMemo(() => {
    const [yearRaw, monthRaw] = calendarMonth.split("-");
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    const base =
      Number.isFinite(year) && Number.isFinite(month)
        ? new Date(year, month - 1, 1)
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const monthKey = toMonthKey(base);
    const firstWeekday = base.getDay();
    const daysInMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();

    const totalsByDay = new Map();
    let monthTotal = 0;

    dailySpendEntries.forEach((entry) => {
      if (!entry.dateKey.startsWith(monthKey)) {
        return;
      }
      monthTotal = round2(monthTotal + entry.amount);
      const day = Number(entry.dateKey.slice(8, 10));
      if (!Number.isFinite(day) || day < 1 || day > daysInMonth) {
        return;
      }

      const current = totalsByDay.get(day) || { total: 0, count: 0 };
      totalsByDay.set(day, {
        total: round2(current.total + entry.amount),
        count: current.count + 1
      });
    });

    const cells = [];
    for (let index = 0; index < firstWeekday; index += 1) {
      cells.push({ type: "empty", key: `empty-${index}` });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const stat = totalsByDay.get(day) || { total: 0, count: 0 };
      cells.push({
        type: "day",
        key: `${monthKey}-${String(day).padStart(2, "0")}`,
        day,
        total: stat.total,
        count: stat.count
      });
    }

    const monthLabel = new Intl.DateTimeFormat("en-IN", {
      month: "long",
      year: "numeric"
    }).format(base);

    return {
      monthKey,
      monthLabel,
      monthTotal: round2(monthTotal),
      cells
    };
  }, [calendarMonth, dailySpendEntries]);

  const expenseMonthOptions = useMemo(() => {
    const months = Array.from(
      new Set(
        expenseHistory
          .map((entry) => String(entry.ts || "").slice(0, 7))
          .filter((value) => value.length === 7)
      )
    );
    return months.sort().reverse();
  }, [expenseHistory]);

  const filteredExpenseHistory = useMemo(() => {
    const query = expenseSearch.trim().toLowerCase();
    return expenseHistory.filter((entry) => {
      const typeMatch = expenseTypeFilter === "ALL" || entry.type === expenseTypeFilter;
      const monthMatch = expenseMonthFilter === "ALL" || String(entry.ts).startsWith(expenseMonthFilter);
      const source = `${entry.message} ${JSON.stringify(entry.meta || {})}`.toLowerCase();
      const searchMatch = !query || source.includes(query);
      return typeMatch && monthMatch && searchMatch;
    });
  }, [expenseHistory, expenseTypeFilter, expenseMonthFilter, expenseSearch]);

  const expenseStats = useMemo(() => {
    let totalExpensesAdded = 0;
    let totalExpensesRemoved = 0;
    let totalPurchases = 0;

    expenseHistory.forEach((entry) => {
      const amount = Number(entry?.meta?.amount || 0);
      if (!Number.isFinite(amount) || amount <= 0) {
        return;
      }

      if (entry.type === "EXPENSE") {
        if (entry.message.toLowerCase().includes("removed")) {
          totalExpensesRemoved += amount;
        } else {
          totalExpensesAdded += amount;
        }
      }

      if (entry.type === "PURCHASE") {
        totalPurchases += amount;
      }
    });

    return {
      totalExpensesAdded: round2(totalExpensesAdded),
      totalExpensesRemoved: round2(totalExpensesRemoved),
      netActiveExpenses: round2(totalExpensesAdded - totalExpensesRemoved),
      totalPurchases: round2(totalPurchases)
    };
  }, [expenseHistory]);

  const monthlySpendTrend = useMemo(() => {
    const monthMap = new Map();

    expenseHistory.forEach((entry) => {
      const key = String(entry.ts || "").slice(0, 7);
      if (key.length !== 7) {
        return;
      }

      if (!monthMap.has(key)) {
        monthMap.set(key, {
          key,
          expensesAdded: 0,
          expensesRemoved: 0,
          purchases: 0
        });
      }

      const bucket = monthMap.get(key);
      const amount = Number(entry?.meta?.amount || 0);
      if (!Number.isFinite(amount) || amount <= 0) {
        return;
      }

      if (entry.type === "EXPENSE") {
        if (entry.message.toLowerCase().includes("removed")) {
          bucket.expensesRemoved += amount;
        } else {
          bucket.expensesAdded += amount;
        }
      }

      if (entry.type === "PURCHASE") {
        bucket.purchases += amount;
      }
    });

    return Array.from(monthMap.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(-8)
      .map((bucket) => {
        const [year, month] = bucket.key.split("-");
        const labelDate = new Date(Number(year), Number(month) - 1, 1);
        const label = Number.isNaN(labelDate.getTime())
          ? bucket.key
          : new Intl.DateTimeFormat("en-IN", { month: "short" }).format(labelDate);

        const net = round2(bucket.expensesAdded + bucket.purchases - bucket.expensesRemoved);
        return {
          ...bucket,
          label,
          net
        };
      });
  }, [expenseHistory]);

  const maxTrendValue = useMemo(() => {
    const maxValue = monthlySpendTrend.reduce((max, item) => Math.max(max, item.net), 0);
    return maxValue > 0 ? maxValue : 1;
  }, [monthlySpendTrend]);

  const expenseCategoryTrend = useMemo(() => {
    const categoryMap = new Map();

    expenseHistory.forEach((entry) => {
      if (entry.type !== "EXPENSE") {
        return;
      }

      const amount = Number(entry?.meta?.amount || 0);
      if (!Number.isFinite(amount) || amount <= 0) {
        return;
      }

      const lower = entry.message.toLowerCase();
      const marker = lower.includes("removed") ? "expense removed:" : "expense added:";
      const index = lower.indexOf(marker);
      const name = index >= 0
        ? entry.message.slice(index + marker.length).trim().replace(/\.$/, "")
        : "Other";

      const delta = lower.includes("removed") ? -amount : amount;
      categoryMap.set(name, round2((categoryMap.get(name) || 0) + delta));
    });

    return Array.from(categoryMap.entries())
      .map(([name, total]) => ({ name, total: Math.max(0, round2(total)) }))
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [expenseHistory]);

  const maxCategoryValue = useMemo(() => {
    const maxValue = expenseCategoryTrend.reduce((max, item) => Math.max(max, item.total), 0);
    return maxValue > 0 ? maxValue : 1;
  }, [expenseCategoryTrend]);

  const exportExpenseHistory = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      total: expenseHistory.length,
      entries: expenseHistory
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `expense-history-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    addLog({ type: "EXPENSE", level: "INFO", message: "Expense history exported to JSON file." });
  };

  const clearExpenseHistory = () => {
    pushUndoSnapshot("Clear expense history");
    setLogs((current) => current.filter((entry) => entry.type !== "EXPENSE" && entry.type !== "PURCHASE"));
  };

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        salary,
        expenses,
        monthsProcessed,
        monthPoolSpent,
        extraSavings,
        spentOnPurchases,
        purchaseHistory,
        logs,
        items
      })
    );
  }, [salary, expenses, monthsProcessed, monthPoolSpent, extraSavings, spentOnPurchases, purchaseHistory, logs, items]);

  return (
    <div className="page">
      <div className="bg-shape bg-shape-one" />
      <div className="bg-shape bg-shape-two" />

      <header className="hero card">
        <div className="hero-head">
          <div className="brand-title">
            <div className="brand-mark">
              <img src={logo} alt="Budgie logo" className="brand-logo" />
            </div>
            <div className="brand-copy">
              <h1>Budgie</h1>
              <span>Smart Savings Planner</span>
            </div>
          </div>
          <button className="ghost undo-top" onClick={undoLastAction} disabled={undoDepth === 0}>
            Undo{undoDepth > 0 ? ` (${undoDepth})` : ""}
          </button>
        </div>
        <p>Track monthly salary, deduct expenses, and auto-distribute your savings into your top goals.</p>
        <div className="page-switch">
          <button
            className={activePage === "planner" ? "switch active" : "switch"}
            onClick={() => setActivePage("planner")}
          >
            Planner
          </button>
          <button
            className={activePage === "analysis" ? "switch active" : "switch"}
            onClick={() => setActivePage("analysis")}
          >
            Expense Analytics
          </button>
        </div>
      </header>

      {activePage === "planner" && (
        <div className="planner-shell">
      <section className="card finance-overview">
        <div className="list-header">
          <h3>Financial Overview</h3>
          <span>This month at a glance</span>
        </div>

        <div className="finance-grid">
          <article className="finance-block">
            <h4><span className="icon-pill"><SalaryIcon /></span> Salary</h4>
            <input
              type="number"
              value={salary}
              onChange={(event) => setSalary(Number(event.target.value || 0))}
              min="0"
            />
          </article>

          <article className="finance-block">
            <h4><span className="icon-pill"><ExpenseIcon /></span> Monthly Expenses</h4>
            <form onSubmit={addExpense} className="expense-form">
              <input
                type="text"
                placeholder="Expense name"
                value={expenseForm.name}
                onChange={(event) =>
                  setExpenseForm((current) => ({ ...current, name: event.target.value }))
                }
              />
              <input
                type="number"
                min="1"
                placeholder="Amount"
                value={expenseForm.amount}
                onChange={(event) =>
                  setExpenseForm((current) => ({ ...current, amount: event.target.value }))
                }
              />
              <button type="submit">Add</button>
            </form>

            <div className="expense-list">
              {expenses.length === 0 ? (
                <p className="empty">No expenses added.</p>
              ) : (
                expenses.map((expense) => (
                  <div className="expense-row" key={expense.id}>
                    <span>{expense.name}</span>
                    <span>{formatCurrency(expense.amount)}</span>
                    <button className="remove" onClick={() => removeExpense(expense.id)}>
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="finance-block total-panel">
            <h4><span className="icon-pill"><SavingsIcon /></span> Total Savings</h4>
            <p>{formatCurrency(totalSavingsWithCurrentExcess)}</p>
            <small>Goals + unassigned + current month excess</small>

            <div className="mini-stats">
              <div>
                <span>Monthly Pool</span>
                <strong>{formatCurrency(monthlyPool)}</strong>
              </div>
              <div>
                <span>Current Excess</span>
                <strong>{formatCurrency(availableMonthExcess)}</strong>
              </div>
              <div>
                <span>Total Expenses</span>
                <strong>{formatCurrency(monthlyExpenseTotal)}</strong>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="dashboard-grid single">
        <article className="card">
          <div className="section-head">
            <h3>Month Engine</h3>
            <p>Track progress, purchases, and run monthly allocation.</p>
          </div>

          <div className="engine-stats" role="list" aria-label="Monthly progress stats">
            <div className="engine-stat" role="listitem">
              <span>Months processed</span>
              <strong>{monthsProcessed}</strong>
            </div>
            <div className="engine-stat" role="listitem">
              <span>Total saved</span>
              <strong>{formatCurrency(totalSavings)}</strong>
            </div>
            <div className="engine-stat" role="listitem">
              <span>Bought items total</span>
              <strong>{formatCurrency(spentOnPurchases)}</strong>
            </div>
            <div className="engine-stat" role="listitem">
              <span>Unassigned savings</span>
              <strong>{formatCurrency(extraSavings)}</strong>
            </div>
          </div>

          <div className="purchase-history">
            <p><strong>Purchase History</strong></p>
            {purchaseHistory.length === 0 ? (
              <p className="empty">No purchases yet.</p>
            ) : (
              purchaseHistory.slice(0, 6).map((entry) => (
                <div key={entry.id} className="purchase-row">
                  <span>{entry.goalName}</span>
                  <span>{formatCurrency(entry.amount)}</span>
                  <span>{formatShortDate(entry.purchasedAt)}</span>
                </div>
              ))
            )}
          </div>

          <div className="daily-spend-panel">
            <div className="list-header">
              <h3>End-of-Day Spending</h3>
              <span>Deducts from savings</span>
            </div>

            <form onSubmit={addDailySpending} className="daily-spend-form">
              <label>
                Date
                <input
                  type="date"
                  value={dailySpendForm.date}
                  onChange={(event) =>
                    setDailySpendForm((current) => ({ ...current, date: event.target.value }))
                  }
                />
              </label>

              <label>
                Amount
                <input
                  type="number"
                  min="1"
                  placeholder="450"
                  value={dailySpendForm.amount}
                  onChange={(event) =>
                    setDailySpendForm((current) => ({ ...current, amount: event.target.value }))
                  }
                />
              </label>

              <label>
                Note (optional)
                <input
                  type="text"
                  placeholder="Dinner, cab, snacks"
                  value={dailySpendForm.note}
                  onChange={(event) =>
                    setDailySpendForm((current) => ({ ...current, note: event.target.value }))
                  }
                />
              </label>

              <button type="submit">Add Daily Spend</button>
            </form>

            {dailySpendError ? <p className="daily-spend-error">{dailySpendError}</p> : null}
            <p className="daily-spend-meta">
              Available savings now: <strong>{formatCurrency(round2(extraSavings + availableMonthExcess))}</strong>
              {" · "}
              Spent today: <strong>{formatCurrency(todaySpendTotal)}</strong>
            </p>
          </div>

          <div className="button-row">
            <button onClick={processMonth}>Process Next Month</button>
            <button className="ghost" onClick={resetProgress}>
              Reset Progress
            </button>
            <button className="danger" onClick={hardResetApp}>
              Hard Reset
            </button>
          </div>

          <div className="inline-ai">
            <div className="list-header">
              <h3><span className="icon-pill inline"><AiIcon /></span> AI Advisor</h3>
              <span>{GEMINI_API_KEY ? "Gemini connected" : "No API key"}</span>
            </div>

            <p className="ai-helper-text">
              Smart percentage suggestions based on your live financial plan.
            </p>

            <div className="button-row ai-buttons">
              <button onClick={runAiAdvisor} disabled={aiLoading}>
                {aiLoading ? "Analyzing..." : "Generate AI Plan"}
              </button>
              <button
                className="ghost"
                onClick={applyAiPercentSuggestions}
                disabled={!aiResult?.suggestedPercents?.length}
              >
                Apply Suggested %
              </button>
            </div>

            {aiError ? <p className="ai-error">{aiError}</p> : null}

            {aiResult ? (
              <div className="ai-result">
                <div className="ai-meta">
                  <span className="ai-pill">Mode: {aiResult.source === "gemini" ? "Gemini" : "Local Smart Fallback"}</span>
                  <span className={`ai-pill health-${aiResult.health?.status || "watch"}`}>
                    Health: {aiResult.health?.status || "watch"}
                  </span>
                  {typeof aiResult.health?.expenseRatioPct === "number" ? (
                    <span className="ai-pill">Expense Ratio: {aiResult.health.expenseRatioPct}%</span>
                  ) : null}
                  {typeof aiResult.health?.savingsRatePct === "number" ? (
                    <span className="ai-pill">Savings Rate: {aiResult.health.savingsRatePct}%</span>
                  ) : null}
                </div>

                <p><strong>Summary:</strong> {aiResult.summary}</p>

                {aiResult.quickActions?.length > 0 ? (
                  <>
                    <p className="ai-subhead"><strong>Next 30 Days</strong></p>
                    <ul>
                      {aiResult.quickActions.map((point, index) => (
                        <li key={`${point}-${index}`}>{point}</li>
                      ))}
                    </ul>
                  </>
                ) : null}

                {aiResult.goalInsights?.length > 0 ? (
                  <div className="ai-goal-insights">
                    <p className="ai-subhead"><strong>Goal Timelines</strong></p>
                    <div className="ai-insights-grid">
                      {aiResult.goalInsights.slice(0, 6).map((item) => (
                        <article className="ai-insight" key={item.goalName}>
                          <h5>{item.goalName}</h5>
                          <p>Remaining: {formatCurrency(item.remaining || 0)}</p>
                          <p>Monthly: {formatCurrency(item.monthlyContribution || 0)}</p>
                          <p>ETA: {item.etaMonths == null ? "No timeline" : `${item.etaMonths} month(s)`}</p>
                        </article>
                      ))}
                    </div>
                  </div>
                ) : null}

                {aiResult.recommendations.length > 0 ? (
                  <>
                    <p className="ai-subhead"><strong>Advisor Notes</strong></p>
                    <ul>
                    {aiResult.recommendations.map((point, index) => (
                      <li key={`${point}-${index}`}>{point}</li>
                    ))}
                    </ul>
                  </>
                ) : null}

                {aiResult.suggestedPercents.length > 0 ? (
                  <div className="ai-map">
                    <p className="ai-subhead"><strong>Suggested Allocation</strong></p>
                    <div className="ai-chip-row">
                      {aiResult.suggestedPercents.map((item) => (
                        <span className="ai-chip" key={`${item.goalName}-${item.percent}`}>
                          {item.goalName}: {item.percent}%
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {!aiResult && aiRawText ? (
              <details className="ai-raw">
                <summary>Raw AI response</summary>
                <pre>{aiRawText}</pre>
              </details>
            ) : null}
          </div>
        </article>
      </section>

      <section className="card goals-section">
        <div className="list-header">
          <h3>Goals & Smart Allocation</h3>
          <span>{items.length} goals</span>
        </div>

        <p className="goal-helper">
          Add a goal with target and priority. Optional savings % reserves part of each month for that goal.
        </p>

        <form onSubmit={addItem} className="goal-form">
          <label>
            Goal name
            <input
              type="text"
              placeholder="MacBook, Bike, Trip..."
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
          </label>

          <label>
            Target amount
            <input
              type="number"
              min="1"
              placeholder="75000"
              value={form.target}
              onChange={(event) => setForm((current) => ({ ...current, target: event.target.value }))}
            />
          </label>

          <label>
            Priority
            <select
              value={form.priority}
              onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}
            >
              {PRIORITY_OPTIONS.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Savings % (optional)
            <input
              type="number"
              min="0"
              max="100"
              placeholder="25"
              value={form.percent}
              onChange={(event) => setForm((current) => ({ ...current, percent: event.target.value }))}
            />
          </label>

          <button type="submit">Add Goal</button>
        </form>

        <p className="allocation-note">
          Fixed % configured: <strong>{allocationSnapshot.meta.fixedPercentInput}%</strong>
          {" · "}
          Applied this month: <strong>{allocationSnapshot.meta.fixedPercentApplied}%</strong>
          {allocationSnapshot.meta.scalingApplied ? " (scaled to avoid going over 100%)" : ""}
        </p>

        {items.length === 0 ? (
          <p className="empty">No goals added yet. Add at least one goal to start distributing your monthly savings.</p>
        ) : (
          <div className="goal-list">
            {items.map((item) => {
              const planned = plannedAllocation.find((entry) => entry.id === item.id)?.amount || 0;
              const progress = Math.min(100, (item.saved / item.target) * 100);
              const canBuyNow = item.saved + extraSavings + availableMonthExcess + 0.01 >= item.target;

              return (
                <article className="goal-card" key={item.id}>
                  <div className="goal-head">
                    <h4>{item.name}</h4>
                    <div className="goal-actions">
                      <button
                        className="buy"
                        onClick={() => buyItem(item.id)}
                        disabled={!canBuyNow}
                      >
                        Buy
                      </button>
                      <button className="remove" onClick={() => removeItem(item.id)}>
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className="goal-details">
                    <div className="goal-metrics">
                      <div className="goal-metric">
                        <span>Target</span>
                        <strong>{formatCurrency(item.target)}</strong>
                      </div>
                      <div className="goal-metric">
                        <span>Saved</span>
                        <strong>{formatCurrency(item.saved)}</strong>
                      </div>
                    </div>

                    <div className="goal-tags">
                      <span className="goal-tag">Priority: <strong>{item.priority}</strong></span>
                      <span className="goal-tag">Explicit %: <strong>{item.percent || 0}%</strong></span>
                      <span className="goal-tag">Monthly: <strong>{formatCurrency(planned)}</strong></span>
                    </div>
                  </div>

                  <div className="progress-wrap">
                    <div className="progress-bar" style={{ width: `${progress}%` }} />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      </div>
      )}

      {activePage === "analysis" && (
      <div className="analysis-shell">
      <section className="card log-section">
        <div className="list-header">
          <h3>Expense History & Analysis</h3>
          <span>{expenseHistory.length} records</span>
        </div>

        <div className="analysis-grid">
          <article className="analysis-card">
            <h4>Monthly Spend Trend</h4>
            {monthlySpendTrend.length === 0 ? (
              <p className="empty">Not enough data for trend chart.</p>
            ) : (
              <div className="bar-chart">
                {monthlySpendTrend.map((month) => (
                  <div key={month.key} className="bar-item">
                    <div
                      className="bar"
                      style={{ height: `${Math.max(6, (month.net / maxTrendValue) * 100)}%` }}
                      title={`${month.label}: ${formatCurrency(month.net)}`}
                    />
                    <span>{month.label}</span>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="analysis-card">
            <h4>Category Spend Split</h4>
            {expenseCategoryTrend.length === 0 ? (
              <p className="empty">No category data yet.</p>
            ) : (
              <div className="category-chart">
                {expenseCategoryTrend.map((item) => (
                  <div className="category-row" key={item.name}>
                    <span>{item.name}</span>
                    <div className="category-bar-wrap">
                      <div
                        className="category-bar"
                        style={{ width: `${Math.max(4, (item.total / maxCategoryValue) * 100)}%` }}
                      />
                    </div>
                    <span>{formatCurrency(item.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </article>
        </div>

        <article className="analysis-card spend-calendar-card">
          <div className="calendar-head">
            <h4>Daily Expense Calendar</h4>
            <div className="calendar-controls">
              <button className="ghost" onClick={() => setCalendarMonth((value) => shiftMonthKey(value, -1))}>
                Prev
              </button>
              <span>{calendarSnapshot.monthLabel}</span>
              <button className="ghost" onClick={() => setCalendarMonth((value) => shiftMonthKey(value, 1))}>
                Next
              </button>
            </div>
          </div>

          <p className="calendar-summary">
            Total spent in {calendarSnapshot.monthLabel}: <strong>{formatCurrency(calendarSnapshot.monthTotal)}</strong>
          </p>

          <div className="calendar-weekdays">
            {WEEKDAY_LABELS.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>

          <div className="calendar-grid">
            {calendarSnapshot.cells.map((cell) =>
              cell.type === "empty" ? (
                <div className="calendar-cell empty" key={cell.key} aria-hidden="true" />
              ) : (
                <div
                  className={`calendar-cell${cell.total > 0 ? " has-spend" : ""}`}
                  key={cell.key}
                  title={
                    cell.total > 0
                      ? `${formatCurrency(cell.total)} across ${cell.count} entr${cell.count > 1 ? "ies" : "y"}`
                      : "No spending"
                  }
                >
                  <span className="day-number">{cell.day}</span>
                  {cell.total > 0 ? (
                    <>
                      <strong>{formatCurrency(cell.total)}</strong>
                      <small>{cell.count} entr{cell.count > 1 ? "ies" : "y"}</small>
                    </>
                  ) : (
                    <small>No spend</small>
                  )}
                </div>
              )
            )}
          </div>
        </article>

        <div className="log-chips">
          <span className="log-chip info">Added {formatCurrency(expenseStats.totalExpensesAdded)}</span>
          <span className="log-chip warn">Removed {formatCurrency(expenseStats.totalExpensesRemoved)}</span>
          <span className="log-chip">Net Active {formatCurrency(expenseStats.netActiveExpenses)}</span>
          <span className="log-chip error">Purchases {formatCurrency(expenseStats.totalPurchases)}</span>
        </div>

        <div className="log-toolbar">
          <select value={expenseTypeFilter} onChange={(event) => setExpenseTypeFilter(event.target.value)}>
            {EXPENSE_HISTORY_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>

          <select value={expenseMonthFilter} onChange={(event) => setExpenseMonthFilter(event.target.value)}>
            <option value="ALL">All Months</option>
            {expenseMonthOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Search expense history"
            value={expenseSearch}
            onChange={(event) => setExpenseSearch(event.target.value)}
          />

          <button className="ghost" onClick={exportExpenseHistory} disabled={expenseHistory.length === 0}>
            Export JSON
          </button>
          <button className="ghost" onClick={clearExpenseHistory} disabled={expenseHistory.length === 0}>
            Clear
          </button>
        </div>

        <div className="log-list">
          {filteredExpenseHistory.length === 0 ? (
            <p className="empty">No matching expense records.</p>
          ) : (
            filteredExpenseHistory.slice(0, 200).map((entry) => (
              <article className={`log-row level-${entry.level.toLowerCase()}`} key={entry.id}>
                <div className="log-row-head">
                  <span>{formatLogTime(entry.ts)}</span>
                  <span>{entry.type}</span>
                  <span>{entry.message.toLowerCase().includes("removed") ? "Removed" : "Added/Spent"}</span>
                </div>
                <p>{entry.message}</p>
                {entry.meta ? <pre className="log-meta">{JSON.stringify(entry.meta, null, 2)}</pre> : null}
              </article>
            ))
          )}
        </div>
      </section>
      </div>
      )}
    </div>
  );
}
