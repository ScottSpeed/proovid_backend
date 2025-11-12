// Temporary workaround - Run this in browser console on proovid.ai

// Get completed jobs
const response = await fetch('https://api.proovid.ai/my-jobs', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('idToken')}`,
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
console.log('Your jobs:', data.jobs);

// Show job IDs and status
data.jobs.forEach(job => {
  console.log(`Job ${job.job_id}: ${job.status}`);
  if (job.result) {
    try {
      const result = JSON.parse(job.result);
      console.log('Labels found:', result.labels?.slice(0, 10));
    } catch (e) {
      console.log('Result:', job.result.slice(0, 200));
    }
  }
});
