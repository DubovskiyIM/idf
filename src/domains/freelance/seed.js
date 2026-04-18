import { v4 as uuid } from "uuid";

/**
 * Seed freelance-домена для dev-режима (Cycle 1).
 * 5 users: 2 customer-only + 2 executor-only + 1 универсал.
 * 10 tasks в 3 категориях (dev / design / copy).
 * 20 responses — от executors на часть tasks.
 */
export function getSeedEffects() {
  const now = Date.now();
  const effects = [];
  const ef = (props) => effects.push({
    id: uuid(), intent_id: "_seed", alpha: "add", scope: "account",
    parent_id: null, status: "confirmed", ttl: null,
    created_at: now, resolved_at: now, ...props,
  });

  // Categories
  const CATEGORIES = [
    { id: "cat_dev", name: "Разработка", slug: "dev", icon: "💻" },
    { id: "cat_design", name: "Дизайн", slug: "design", icon: "🎨" },
    { id: "cat_copy", name: "Копирайтинг", slug: "copy", icon: "✍️" },
  ];
  CATEGORIES.forEach(c => ef({ target: "Category", context: c }));

  // Skills
  const SKILLS = [
    { id: "skill_js", name: "JavaScript", categoryId: "cat_dev" },
    { id: "skill_react", name: "React", categoryId: "cat_dev" },
    { id: "skill_node", name: "Node.js", categoryId: "cat_dev" },
    { id: "skill_figma", name: "Figma", categoryId: "cat_design" },
    { id: "skill_illustrator", name: "Illustrator", categoryId: "cat_design" },
    { id: "skill_seo", name: "SEO-тексты", categoryId: "cat_copy" },
  ];
  SKILLS.forEach(s => ef({ target: "Skill", context: s }));

  // Users
  const USERS = [
    {
      id: "u_customer_1", name: "Алиса Заказчикова", email: "alisa@freelance.local",
      city: "Москва", customerVerified: true, executorVerified: false,
    },
    {
      id: "u_customer_2", name: "Борис Клиентов", email: "boris@freelance.local",
      city: "Санкт-Петербург", customerVerified: true, executorVerified: false,
    },
    {
      id: "u_executor_1", name: "Виктор Разработчиков", email: "viktor@freelance.local",
      city: "Казань", customerVerified: false, executorVerified: true,
    },
    {
      id: "u_executor_2", name: "Галина Дизайнова", email: "galya@freelance.local",
      city: "Новосибирск", customerVerified: false, executorVerified: true,
    },
    {
      id: "u_universal", name: "Дима Универсалов", email: "dima@freelance.local",
      city: "Екатеринбург", customerVerified: true, executorVerified: true,
    },
  ];
  USERS.forEach(u => ef({ target: "User", context: { ...u, createdAt: now } }));

  // CustomerProfile для всех customer-флагнутых
  USERS.filter(u => u.customerVerified).forEach(u => {
    ef({
      target: "CustomerProfile",
      context: {
        id: `cust_${u.id}`, userId: u.id, displayName: u.name, city: u.city, createdAt: now,
      },
    });
  });

  // ExecutorProfile для всех executor-флагнутых
  const EXEC_PROFILES = [
    { userId: "u_executor_1", bio: "Fullstack React + Node, 5 лет", rating: 4.8, level: "Эксперт", completedDeals: 47, minPrice: 30000, avgDeliveryHours: 72 },
    { userId: "u_executor_2", bio: "UI/UX дизайнер, brand identity", rating: 4.9, level: "Мастер", completedDeals: 112, minPrice: 50000, avgDeliveryHours: 48 },
    { userId: "u_universal", bio: "Копирайтинг и лёгкий фронтенд", rating: 4.5, level: "Специалист", completedDeals: 18, minPrice: 15000, avgDeliveryHours: 96 },
  ];
  EXEC_PROFILES.forEach(p => {
    ef({
      target: "ExecutorProfile",
      context: {
        id: `exec_${p.userId}`,
        ...p,
        availability: "available",
        createdAt: now,
      },
    });
  });

  // ExecutorSkill
  const EXEC_SKILLS = [
    { executorId: "u_executor_1", skillId: "skill_js" },
    { executorId: "u_executor_1", skillId: "skill_react" },
    { executorId: "u_executor_1", skillId: "skill_node" },
    { executorId: "u_executor_2", skillId: "skill_figma" },
    { executorId: "u_executor_2", skillId: "skill_illustrator" },
    { executorId: "u_universal", skillId: "skill_seo" },
    { executorId: "u_universal", skillId: "skill_js" },
  ];
  EXEC_SKILLS.forEach((s, i) => {
    ef({
      target: "ExecutorSkill",
      context: { id: `es_${i}`, ...s, createdAt: now },
    });
  });

  // Tasks (10)
  const TASKS = [
    { id: "task_1", customerId: "u_customer_1", title: "Лендинг на React", categoryId: "cat_dev", budget: 80000, deadline: now + 7 * 86400_000, city: "Москва", type: "remote", status: "published" },
    { id: "task_2", customerId: "u_customer_1", title: "Редизайн мобильного приложения", categoryId: "cat_design", budget: 120000, deadline: now + 14 * 86400_000, city: "Москва", type: "remote", status: "published" },
    { id: "task_3", customerId: "u_customer_2", title: "API для интернет-магазина", categoryId: "cat_dev", budget: 200000, deadline: now + 21 * 86400_000, city: "Санкт-Петербург", type: "remote", status: "published" },
    { id: "task_4", customerId: "u_customer_2", title: "Логотип для кофейни", categoryId: "cat_design", budget: 25000, deadline: now + 5 * 86400_000, city: "Санкт-Петербург", type: "remote", status: "published" },
    { id: "task_5", customerId: "u_universal", title: "Тексты для сайта школы", categoryId: "cat_copy", budget: 15000, deadline: now + 10 * 86400_000, city: "Екатеринбург", type: "remote", status: "published" },
    { id: "task_6", customerId: "u_customer_1", title: "Telegram-бот для уведомлений", categoryId: "cat_dev", budget: 45000, deadline: now + 12 * 86400_000, city: "Москва", type: "remote", status: "published" },
    { id: "task_7", customerId: "u_customer_2", title: "Иконки для SaaS", categoryId: "cat_design", budget: 35000, deadline: now + 8 * 86400_000, city: "Санкт-Петербург", type: "remote", status: "published" },
    { id: "task_8", customerId: "u_customer_1", title: "SEO-статьи про недвижимость (пакет 10 шт)", categoryId: "cat_copy", budget: 30000, deadline: now + 15 * 86400_000, city: "Москва", type: "remote", status: "published" },
    { id: "task_9", customerId: "u_customer_2", title: "Monte Carlo simulator", categoryId: "cat_dev", budget: 150000, deadline: now + 30 * 86400_000, city: "Санкт-Петербург", type: "remote", status: "moderation" },
    { id: "task_10", customerId: "u_universal", title: "Обложка для YouTube-канала", categoryId: "cat_design", budget: 8000, deadline: now + 3 * 86400_000, city: "Екатеринбург", type: "remote", status: "draft" },
  ];
  TASKS.forEach(t => {
    ef({
      target: "Task",
      context: { ...t, description: `Подробное описание: ${t.title}`, responsesCount: 0, createdAt: now - Math.random() * 3 * 86400_000 },
    });
  });

  // Responses (20 — несколько на каждую published task)
  const RESPONSES = [
    { taskId: "task_1", executorId: "u_executor_1", price: 75000, deliveryDays: 7, message: "Опыт 5 лет с React, покажу портфолио" },
    { taskId: "task_1", executorId: "u_universal", price: 60000, deliveryDays: 10, message: "Могу взяться на следующей неделе" },
    { taskId: "task_2", executorId: "u_executor_2", price: 115000, deliveryDays: 14, message: "Специализация — мобильный UX" },
    { taskId: "task_3", executorId: "u_executor_1", price: 190000, deliveryDays: 18, message: "Сделаю на Fastify + Prisma" },
    { taskId: "task_3", executorId: "u_universal", price: 180000, deliveryDays: 21, message: "Node.js опыт, готов обсудить детали" },
    { taskId: "task_4", executorId: "u_executor_2", price: 25000, deliveryDays: 5, message: "Сделаю 3 концепта на выбор" },
    { taskId: "task_5", executorId: "u_universal", price: 14000, deliveryDays: 10, message: "Напишу с SEO-оптимизацией" },
    { taskId: "task_6", executorId: "u_executor_1", price: 42000, deliveryDays: 10, message: "Python-aiogram или Node.js — как удобнее" },
    { taskId: "task_6", executorId: "u_universal", price: 40000, deliveryDays: 12, message: "Опыт с Telegram API" },
    { taskId: "task_7", executorId: "u_executor_2", price: 32000, deliveryDays: 8, message: "Векторные иконки, Figma + SVG экспорт" },
    { taskId: "task_8", executorId: "u_universal", price: 28000, deliveryDays: 14, message: "Профильная ниша недвижимости" },
    { taskId: "task_1", executorId: "u_executor_2", price: 90000, deliveryDays: 5, message: "Дизайн + вёрстка + деплой" },
    { taskId: "task_2", executorId: "u_executor_1", price: 125000, deliveryDays: 16, message: "React Native + backend" },
    { taskId: "task_3", executorId: "u_executor_2", price: 210000, deliveryDays: 25, message: "Архитектура + дизайн" },
    { taskId: "task_4", executorId: "u_universal", price: 22000, deliveryDays: 6, message: "Нарисую быстро" },
    { taskId: "task_5", executorId: "u_executor_2", price: 18000, deliveryDays: 8, message: "Возьмусь параллельно с другим проектом" },
    { taskId: "task_6", executorId: "u_executor_2", price: 50000, deliveryDays: 7, message: "Добавлю админ-панель" },
    { taskId: "task_7", executorId: "u_executor_1", price: 30000, deliveryDays: 10, message: "Сделаю пакет + темная/светлая тема" },
    { taskId: "task_8", executorId: "u_executor_1", price: 32000, deliveryDays: 12, message: "Если нужно — с версткой html" },
    { taskId: "task_8", executorId: "u_executor_2", price: 26000, deliveryDays: 14, message: "Тексты + иллюстрации" },
  ];
  RESPONSES.forEach((r, i) => {
    ef({
      target: "Response",
      context: {
        id: `r_${i + 1}`, ...r, status: "pending",
        createdAt: now - Math.random() * 2 * 86400_000,
      },
    });
  });

  return effects;
}
