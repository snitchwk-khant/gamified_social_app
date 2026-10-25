export const EMPLOYEE_DETAIL_FIELDS = "id,avatar_url,full_name,email,role,employment_start_date";

const EMPLOYMENT_DATE_RPC = "set_profile_employment_start_date";
const EMPLOYMENT_DATE_PLACEHOLDER = "0001-01-01";
const EXPECTED_EMPLOYEE_DETAIL_FIELDS = EMPLOYEE_DETAIL_FIELDS.split(",").sort();
const SAVE_ERROR_MESSAGE = "Unable to save employment start date.";

export function normalizeDateValue(value) {
  return value ? value.toString().slice(0, 10) : "";
}

export function getEmploymentStartDateValidationError(value, todayDateValue) {
  const normalizedDate = normalizeDateValue(value);

  if (normalizedDate === EMPLOYMENT_DATE_PLACEHOLDER) {
    return "Start Date cannot use the placeholder value 0001-01-01.";
  }

  if (normalizedDate && normalizedDate > todayDateValue) {
    return "Start Date cannot be in the future.";
  }

  return "";
}

export function normalizeEmploymentStartDateInput(value) {
  const normalizedDate = value?.toString().trim() || "";
  return normalizedDate || null;
}

function hasExpectedEmployeeDetailFields(row) {
  return (
    row &&
    typeof row === "object" &&
    !Array.isArray(row) &&
    JSON.stringify(Object.keys(row).sort()) === JSON.stringify(EXPECTED_EMPLOYEE_DETAIL_FIELDS)
  );
}

export async function setProfileEmploymentStartDate(supabaseClient, employeeId, dateValue) {
  const normalizedDate = normalizeEmploymentStartDateInput(dateValue);

  if (normalizedDate === EMPLOYMENT_DATE_PLACEHOLDER) {
    throw new Error("Start Date cannot use the placeholder value 0001-01-01.");
  }

  const { data, error } = await supabaseClient.rpc(EMPLOYMENT_DATE_RPC, {
    target_profile_id: employeeId,
    target_employment_start_date: normalizedDate,
  });

  if (error) {
    throw error;
  }

  if (
    !Array.isArray(data) ||
    data.length !== 1 ||
    !hasExpectedEmployeeDetailFields(data[0]) ||
    data[0].id !== employeeId ||
    data[0].employment_start_date !== normalizedDate
  ) {
    throw new Error(SAVE_ERROR_MESSAGE);
  }

  return data[0];
}
