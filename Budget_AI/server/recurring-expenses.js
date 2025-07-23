require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function getNextDate(last, frequency) {
  const date = new Date(last);
  switch (frequency) {
    case 'Daily':
      date.setDate(date.getDate() + 1);
      break;
    case 'Weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'Monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'Quarterly':
      date.setMonth(date.getMonth() + 3);
      break;
    case '6 Months':
      date.setMonth(date.getMonth() + 6);
      break;
    case 'Yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;
    default:
      break;
  }
  return date.toISOString().split('T')[0];
}

async function processRecurringExpenses() {
  const { data: recurringExpenses, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('is_recurring', true);

  if (error) {
    console.error('Error fetching recurring expenses:', error.message);
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  for (const exp of recurringExpenses) {
    let lastDate = exp.last_occurred;
    let nextDate = getNextDate(lastDate, exp.frequency);
    while (nextDate && nextDate <= today) {
      // Stop if recurring_end_date is set and nextDate is after it
      if (exp.recurring_end_date && nextDate > exp.recurring_end_date) {
        // Mark the original recurring expense as inactive
        await supabase
          .from('expenses')
          .update({ is_recurring: false })
          .eq('id', exp.id);
        break;
      }
      // Check if an expense for nextDate already exists for this user/category
      const { data: existingExpenses, error: checkError } = await supabase
        .from('expenses')
        .select('id')
        .eq('user_id', exp.user_id)
        .eq('category', exp.category)
        .eq('date', nextDate)
        .eq('is_recurring', true);

      if (checkError) {
        console.error('Error checking for existing expense:', checkError.message);
        break;
      }

      // Delete any extra generated recurring expenses that exceed the end date
      if (exp.recurring_end_date && nextDate > exp.recurring_end_date) {
        if (existingExpenses && existingExpenses.length > 0) {
          for (const e of existingExpenses) {
            await supabase.from('expenses').delete().eq('id', e.id);
            console.log(`Deleted extra recurring expense with id ${e.id} for user ${exp.user_id} on ${nextDate}`);
          }
        }
        // Mark the original recurring expense as inactive
        await supabase
          .from('expenses')
          .update({ is_recurring: false })
          .eq('id', exp.id);
        break;
      }

      if (!existingExpenses || existingExpenses.length === 0) {
        // Insert a new expense for nextDate
        const { error: insertError } = await supabase.from('expenses').insert({
          user_id: exp.user_id,
          amount: exp.amount,
          category: exp.category,
          description: exp.description,
          date: nextDate,
          payment_method: exp.payment_method,
          frequency: exp.frequency,
          is_recurring: true,
          recurring_start_date: exp.recurring_start_date,
          last_occurred: nextDate,
          recurring_next_date: getNextDate(nextDate, exp.frequency)
        });

        if (insertError) {
          console.error('Error inserting recurring expense:', insertError.message);
          break;
        }
      } else {
        console.log(`Recurring expense for user ${exp.user_id} on ${nextDate} already exists, skipping insert.`);
      }

      // Update last_occurred and recurring_next_date for the original recurring expense
      const { error: updateError } = await supabase
        .from('expenses')
        .update({ last_occurred: nextDate, recurring_next_date: getNextDate(nextDate, exp.frequency) })
        .eq('id', exp.id);

      if (updateError) {
        console.error('Error updating last_occurred/recurring_next_date:', updateError.message);
        break;
      } else {
        console.log(`Recurring expense for user ${exp.user_id} processed for ${nextDate}, next on ${getNextDate(nextDate, exp.frequency)}`);
      }
      lastDate = nextDate;
      nextDate = getNextDate(lastDate, exp.frequency);
    }
    // Always update recurring_next_date for visibility if no catch-up was needed
    if (lastDate === exp.last_occurred) {
      await supabase
        .from('expenses')
        .update({ recurring_next_date: nextDate })
        .eq('id', exp.id);
    }
  }
}

// One-time cleanup: Delete extra recurring expenses after their end date
async function cleanupExtraRecurringExpenses() {
  const { data: recurringExpenses, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('is_recurring', true);

  if (error) {
    console.error('Error fetching recurring expenses for cleanup:', error.message);
    return;
  }

  for (const exp of recurringExpenses) {
    if (exp.recurring_end_date) {
      // Delete all recurring expenses for this user/category after the end date
      const { data: extraExpenses, error: fetchError } = await supabase
        .from('expenses')
        .select('id, date')
        .eq('user_id', exp.user_id)
        .eq('category', exp.category)
        .eq('is_recurring', true)
        .gt('date', exp.recurring_end_date);

      if (fetchError) {
        console.error('Error fetching extra recurring expenses:', fetchError.message);
        continue;
      }

      if (extraExpenses && extraExpenses.length > 0) {
        for (const e of extraExpenses) {
          await supabase.from('expenses').delete().eq('id', e.id);
          console.log(`Cleanup: Deleted extra recurring expense with id ${e.id} for user ${exp.user_id} on ${e.date}`);
        }
      }

      // Mark the original recurring expense as inactive if its end date has passed
      const today = new Date().toISOString().split('T')[0];
      if (today > exp.recurring_end_date) {
        await supabase
          .from('expenses')
          .update({ is_recurring: false })
          .eq('id', exp.id);
        console.log(`Cleanup: Marked recurring expense with id ${exp.id} as inactive (end date passed)`);
      }
    }
  }
}

// Run cleanup before processing recurring expenses
cleanupExtraRecurringExpenses().then(() => {
  processRecurringExpenses().then(() => {
    console.log('Initial recurring expenses processing complete.');
  });
});

// Run every 24 hours (86,400,000 ms)
setInterval(() => {
  processRecurringExpenses().then(() => {
    console.log('Recurring expenses processing complete.');
  });
}, 24 * 60 * 60 * 1000); 