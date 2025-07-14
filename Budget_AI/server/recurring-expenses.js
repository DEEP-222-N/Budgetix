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
    // Use recurring_next_date if available, otherwise calculate from last_occurred
    const nextDate = exp.recurring_next_date || getNextDate(exp.last_occurred, exp.frequency);
    if (nextDate && nextDate <= today) {
      // Insert a new expense for today
      const { error: insertError } = await supabase.from('expenses').insert({
        user_id: exp.user_id,
        amount: exp.amount,
        category: exp.category,
        description: exp.description,
        date: today,
        payment_method: exp.payment_method,
        frequency: exp.frequency,
        is_recurring: true,
        recurring_start_date: exp.recurring_start_date,
        last_occurred: today,
        recurring_next_date: getNextDate(today, exp.frequency)
      });

      if (insertError) {
        console.error('Error inserting recurring expense:', insertError.message);
        continue;
      }

      // Update last_occurred and recurring_next_date for the original recurring expense
      const { error: updateError } = await supabase
        .from('expenses')
        .update({ last_occurred: today, recurring_next_date: getNextDate(today, exp.frequency) })
        .eq('id', exp.id);

      if (updateError) {
        console.error('Error updating last_occurred/recurring_next_date:', updateError.message);
      } else {
        console.log(`Recurring expense for user ${exp.user_id} added for ${today}, next on ${getNextDate(today, exp.frequency)}`);
      }
    } else {
      // Always update recurring_next_date for visibility
      await supabase
        .from('expenses')
        .update({ recurring_next_date: nextDate })
        .eq('id', exp.id);
    }
  }
}

processRecurringExpenses().then(() => {
  console.log('Recurring expenses processing complete.');
  process.exit(0);
}); 