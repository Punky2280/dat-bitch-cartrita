// packages/frontend/src/pages/AboutPage.tsx
import MarkdownPage from '@/components/MarkdownPage'; // FIXED: Using path alias

const AboutPage = () => {
  return <MarkdownPage fileName="about.md" />;
};

export default AboutPage;
