/** Format an ISO date string to "Mon DD, YYYY" */
export const formatDate = (dateString: string): string =>
  new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/** Format "HH:MM" 24h string to "H:MM AM/PM" */
export const formatTime = (timeString: string): string => {
  if (!timeString) return '';
  const [h, m] = timeString.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
};

/** Format a dollar amount to "$X.XX" or "Free" */
export const formatCurrency = (dollars: number | null | undefined): string => {
  if (!dollars) return 'Free';
  return `$${dollars.toFixed(2)}`;
};
