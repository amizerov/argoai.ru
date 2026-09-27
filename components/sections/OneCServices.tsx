import { ContactFormButton } from "@/components/ContactFormButton";
import { Reveal } from "@/components/ui/Reveal";
import styles from "./OneCServices.module.css";

const services = [
  { title: "Отчёты", text: "Нужные колонки, отборы и группировки для ваших рабочих задач." },
  { title: "Печатные формы", text: "Доработка счетов, актов и других форм под ваши шаблоны." },
  { title: "Обработки", text: "Загрузка из Excel, выгрузка данных и пакетное заполнение реквизитов." },
  { title: "Обмен данными", text: "Настройка и исправление обменов с сайтом и другими системами." },
];

export function OneCServices() {
  return (
    <section id="1c" aria-labelledby="one-c-title" className={styles.section}>
      <Reveal className={styles.panel}>
        <div className={styles.intro}>
          <span className="kicker">БЕРЁМ И НЕБОЛЬШИЕ ЗАДАЧИ</span>
          <h3 id="one-c-title">Доработки 1С</h3>
          <p>Можно начать с одного отчёта или обработки. Опишите задачу и укажите конфигурацию 1С — согласуем объём, стоимость и срок до начала работ.</p>
          <ContactFormButton label="Обсудить задачу по 1С" topic="1c" />
        </div>
        <ul className={styles.services}>
          {services.map((service) => (
            <li key={service.title}>
              <h4>{service.title}</h4>
              <p>{service.text}</p>
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}
