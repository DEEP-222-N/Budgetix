require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
// Use the Service Role key for backend jobs (required for admin operations)
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

// Debug logging
console.log('Environment variables loaded:');
console.log('SUPABASE_URL:', SUPABASE_URL ? 'Set' : 'NOT SET');
console.log('SUPABASE_ANON_KEY:', SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'NOT SET');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required environment variables!');
  console.error('SUPABASE_URL:', SUPABASE_URL);
  console.error('SUPABASE_ANON_KEY:', SUPABASE_SERVICE_ROLE_KEY);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkUserExists(userId) {
  try {
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (error) {
      console.error(`Admin user lookup error for ${userId}:`, error.message);
      return false;
    }
    return !!data && !!data.user;
  } catch (e) {
    console.error(`Exception during user lookup for ${userId}:`, e.message);
    return false;
  }
}

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
    // Verify the user exists via admin API. If not, disable this recurring expense and skip.
    const exists = await checkUserExists(exp.user_id);
    if (!exists) {
      console.log(`Skipping recurring expense ${exp.id} - user ${exp.user_id} not found. Marking inactive.`);
      try {
        await supabase.from('expenses').update({ is_recurring: false }).eq('id', exp.id);
      } catch (e) {
        console.error(`Failed to mark expense ${exp.id} inactive:`, e.message);
      }
      continue;
    }

    // Skip processing if end date has already passed
    if (exp.recurring_end_date && today > exp.recurring_end_date) {
      // Mark the recurring expense as inactive if end date has passed
      await supabase
        .from('expenses')
        .update({ is_recurring: false })
        .eq('id', exp.id);
      console.log(`Recurring expense ${exp.id} has reached its end date (${exp.recurring_end_date}) and has been marked as inactive`);
      continue;
    }

    let lastDate = exp.last_occurred;
    let nextDate = getNextDate(lastDate, exp.frequency);
    
    // Skip if there's no next date or if next date is in the future
    if (!nextDate || nextDate > today) {
      continue;
    }

    // Process recurring expenses up to today or end date
    while (nextDate && nextDate <= today) {
      // Stop if recurring_end_date is set and nextDate is after it
      if (exp.recurring_end_date && nextDate > exp.recurring_end_date) {
        // Mark the original recurring expense as inactive
        await supabase
          .from('expenses')
          .update({ is_recurring: false })
          .eq('id', exp.id);
        console.log(`Recurring expense ${exp.id} has reached its end date (${exp.recurring_end_date}) and has been marked as inactive`);
        break;
      }

      // Check if an expense for nextDate already exists for this user/category
      const { data: existingExpenses, error: checkError } = await supabase
        .from('expenses')
        .select('id')
        .eq('user_id', exp.user_id)
        .eq('category', exp.category)
        .eq('date', nextDate)
        // We consider any expense on the target date (recurring or not) as existing to avoid duplicates
        ;

      if (checkError) {
        console.error('Error checking for existing expense:', checkError.message);
        break;
      }

      if (!existingExpenses || existingExpenses.length === 0) {
        try {
          // Insert a new expense for nextDate
          const { error: insertError } = await supabase.from('expenses').insert({
            user_id: exp.user_id,
            amount: exp.amount,
            category: exp.category,
            description: exp.description,
            date: nextDate,
            payment_method: exp.payment_method,
            frequency: exp.frequency,
            // Inserted instances should NOT be marked recurring; only the template is recurring
            is_recurring: false,
            recurring_start_date: exp.recurring_start_date,
            last_occurred: nextDate,
            recurring_next_date: getNextDate(nextDate, exp.frequency),
            // Propagate end date to ensure instances also stop after end date
            recurring_end_date: exp.recurring_end_date
          });

      if (insertError) {
            console.error('Error inserting recurring expense:', insertError.message);
            // If there's a foreign key constraint error, mark this recurring expense as inactive
            if (insertError.message && insertError.message.includes('foreign key constraint')) {
              try {
                await supabase.from('expenses').update({ is_recurring: false }).eq('id', exp.id);
                console.log(`Marked recurring expense ${exp.id} as inactive due to foreign key constraint error`);
              } catch (e) {
                console.error(`Failed to mark expense ${exp.id} inactive after FK error:`, e.message);
              }
            }
            break;
          }
        } catch (error) {
          console.error('Exception while inserting recurring expense:', error.message);
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

  const today = new Date().toISOString().split('T')[0];
  
  for (const exp of recurringExpenses) {
    // Verify the user exists via admin API; if not, disable this recurring record
    const exists = await checkUserExists(exp.user_id);
    if (!exists) {
      console.log(`Cleanup: Skipping recurring expense ${exp.id} - user ${exp.user_id} does not exist in auth.users table`);
      try {
        await supabase
          .from('expenses')
          .update({ is_recurring: false })
          .eq('id', exp.id);
      } catch (e) {
        console.error(`Cleanup: Failed to mark expense ${exp.id} inactive:`, e.message);
      }
      continue;
    }

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
          try {
            await supabase.from('expenses').delete().eq('id', e.id);
            console.log(`Cleanup: Deleted extra recurring expense with id ${e.id} for user ${exp.user_id} on ${e.date}`);
          } catch (error) {
            console.error(`Error deleting extra recurring expense ${e.id}:`, error.message);
          }
        }
      }

      // Mark the original recurring expense as inactive if its end date has passed
      if (today > exp.recurring_end_date) {
        await supabase
          .from('expenses')
          .update({ is_recurring: false })
          .eq('id', exp.id);
        console.log(`Cleanup: Marked recurring expense with id ${exp.id} as inactive (end date passed: ${exp.recurring_end_date})`);
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