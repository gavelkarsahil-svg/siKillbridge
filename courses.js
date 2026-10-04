// v(title, youtubeVideoId, minutes). Replace each VIDEO_ID with the part after v= in a YouTube link.
// To add a course, copy one block, give it a new unique id and edit the text.
const v = (t, y, m) => ({ t, y, m });

export const COURSES = [
  { id: 'design', ico: '🎨', cat: 'Design', level: 'Beginner', by: 'Your instructor name',
    title: 'Graphic design fundamentals',
    desc: 'Learn layout, colour and typography, then design a logo you can put in a portfolio.',
    videos: [v('Design basics', 'VIDEO_ID', 12), v('Colour and type', 'VIDEO_ID', 15), v('Build a logo', 'VIDEO_ID', 20)] },
  { id: 'web', ico: '💻', cat: 'Development', level: 'Beginner', by: 'Your instructor name',
    title: 'Web development from zero',
    desc: 'HTML, CSS and JavaScript step by step, finishing with a live website on GitHub Pages.',
    videos: [v('HTML in 20 minutes', 'VIDEO_ID', 20), v('Styling with CSS', 'VIDEO_ID', 25), v('First JavaScript', 'VIDEO_ID', 30), v('Publish on GitHub', 'VIDEO_ID', 10)] },
  { id: 'marketing', ico: '📣', cat: 'Marketing', level: 'Beginner', by: 'Your instructor name',
    title: 'Digital marketing essentials',
    desc: 'Plan social, search and email campaigns and read the numbers that show what works.',
    videos: [v('The marketing funnel', 'VIDEO_ID', 14), v('Social media plan', 'VIDEO_ID', 18), v('Read your analytics', 'VIDEO_ID', 16)] },
  { id: 'it', ico: '🛠️', cat: 'IT', level: 'Intermediate', by: 'Your instructor name',
    title: 'IT support and security',
    desc: 'Troubleshoot computers, understand networks and keep users safe online.',
    videos: [v('How computers work', 'VIDEO_ID', 17), v('Networking basics', 'VIDEO_ID', 22), v('Stay secure', 'VIDEO_ID', 15)] }
];
