import { Bot, Braces, DatabaseZap, FileSearch, Network, ScanSearch } from "lucide-react";

export const navigation = [
  { label: "Технологии", href: "#technology" }, { label: "Решения", href: "#solutions" },
  { label: "Проекты", href: "#projects" }, { label: "Исследования", href: "#research" },
  { label: "О компании", href: "#about" }, { label: "Контакты", href: "#contacts" },
];

export const solutions = [
  { icon: DatabaseZap, index: "01", title: "Локальные AI-системы", text: "Развёртывание LLM внутри инфраструктуры организации — без передачи корпоративных данных внешним AI-сервисам.", accent: "blue" },
  { icon: ScanSearch, index: "02", title: "RAG и базы знаний", text: "Поиск и точные ответы по внутренним документам, регламентам, базам данных и корпоративным знаниям.", accent: "violet" },
  { icon: Network, index: "03", title: "Семантический поиск", text: "Embedding-модели и vector search для поиска по смыслу и сопоставления сущностей между системами.", accent: "cyan" },
  { icon: Braces, index: "04", title: "AI-интеграция", text: "Интеллектуальный слой над существующими ИС: API, MCP, SQL, REST и корпоративные базы данных.", accent: "violet" },
  { icon: FileSearch, index: "05", title: "Обработка документов", text: "Извлечение, классификация и поиск в PDF, DOCX, XLSX, PPTX, почте и сканированных документах.", accent: "blue" },
  { icon: Bot, index: "06", title: "AI Agents", text: "Агенты, способные работать с корпоративными системами и выполнять многошаговые операции.", accent: "cyan" },
];

export const projects = [
  { type: "ПРОЕКТ", number: "01", title: "Семантический поиск учебных дисциплин", text: "Сопоставление десятков тысяч наименований дисциплин из различных информационных систем с помощью multilingual embedding models.", tech: ["BGE-M3", "ONNX", "Vector Search", "SQL Server", "FastAPI"] },
  { type: "НАПРАВЛЕНИЕ", number: "02", title: "Интеллектуальная система расписаний", text: "Интеграция учебных планов, педагогической нагрузки, аудиторного фонда и расписаний в единой информационной модели.", tech: ["Next.js", "TypeScript", "SQL Server", "AI Search"] },
  { type: "ПРОТОТИП", number: "03", title: "Corporate Knowledge AI", text: "Локальная AI-платформа для безопасной работы с внутренними документами организации.", tech: ["LLM", "RAG", "OCR", "MCP", "Vector DB"] },
];

export const researchAreas = ["Semantic entity matching", "Multilingual embeddings", "Локальные LLM", "Retrieval augmented generation", "Интеллектуальная интеграция данных", "AI-агенты", "Knowledge graphs", "Автоматизация документов"];
export const stats = [
  { value: "70 000+", label: "наименований дисциплин в одном из массивов данных" },
  { value: "62 000+", label: "дисциплин в учебных данных" },
];
