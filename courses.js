// ONE YOUTUBE LINK PER COURSE
// Paste your link in the `link` line of each course. It can be:
//   - a playlist link  (https://www.youtube.com/playlist?list=PL...)  -> every video in the playlist is shown as a lesson
//   - a single video   (https://www.youtube.com/watch?v=... or https://youtu.be/...)  -> the course is that one video
// `len` and `learn` are only the text shown on the course page. Edit them to match your video.

export const COURSES = [
  { id: 'graphic-design', ico: '🎨', cat: 'Design', level: 'Beginner', by: 'Your instructor name', len: 'About 4 hours',
    title: 'Graphic design fundamentals',
    desc: 'Learn layout, colour and typography, then design a logo you can put in a portfolio.',
    learn: ['Layout and composition', 'Colour and typography', 'Working with images', 'Designing a logo'],
    link: 'https://youtube.com/playlist?list=PLgGbWId6zgaXiWYDAcJbXzBNlAnYg7pgL&si=IoKXfEIKZG-QrWym' },

  { id: 'web-development', ico: '💻', cat: 'Development', level: 'Beginner', by: 'Your instructor name', len: 'About 6 hours',
    title: 'Web development and coding',
    desc: 'HTML, CSS and JavaScript step by step, finishing with a live website on GitHub Pages.',
    learn: ['HTML structure', 'Styling with CSS', 'JavaScript basics', 'Publishing a website'],
    link: 'https://youtube.com/playlist?list=PLfqMhTWNBTe3H6c9OGXb5_6wcc1Mca52n&si=hvJrqus1Nh4GapIn' },

  { id: 'digital-marketing', ico: '📣', cat: 'Marketing', level: 'Beginner', by: 'Your instructor name', len: 'About 4 hours',
    title: 'Digital marketing',
    desc: 'Plan social, search and email campaigns and read the numbers that show what works.',
    learn: ['The marketing funnel', 'Social media plans', 'Search and SEO basics', 'Reading analytics'],
    link: 'https://youtu.be/XuUbLHIRyuM?si=GQ65tWcWlESfsSLl' },

  { id: 'ui-ux-design', ico: '📱', cat: 'Design', level: 'Beginner', by: 'Your instructor name', len: 'About 5 hours',
    title: 'UI and UX design',
    desc: 'Research users, sketch wireframes and design app screens people find easy to use.',
    learn: ['User research', 'Wireframes', 'Visual interface design', 'Prototyping in Figma'],
    link: 'https://youtube.com/playlist?list=PLdvOfoe7PXT0ouChAnR1nHlT8BJIo5hP_&si=2EzoeYg0Zo8V5hqF' },

  { id: 'cyber-security', ico: '🔒', cat: 'Security', level: 'Beginner', by: 'Your instructor name', len: 'About 4 hours',
    title: 'Cyber security fundamentals',
    desc: 'Understand common attacks and learn the habits that keep people and systems safe.',
    learn: ['Common cyber attacks', 'Passwords and phishing', 'Malware and protection', 'Staying safe online'],
    link: 'https://youtube.com/playlist?list=PLlgLmuG_Kgba6K93PuVuf9aP_UFnm7mCl&si=EBoYU3x4B2DAqQ4C' },

  { id: 'it-networking', ico: '🛠️', cat: 'IT', level: 'Intermediate', by: 'Your instructor name', len: 'About 5 hours',
    title: 'IT support and networking',
    desc: 'Troubleshoot computers, understand how networks work and help users solve problems.',
    learn: ['How computers work', 'Networking basics', 'Troubleshooting steps', 'Helping users'],
    link: 'https://youtube.com/playlist?list=PLS0spxc8nUsARM_Z8Ou9sXo_HzWA89tYX&si=QNIjqPGWmzsTvJGp' }
];
