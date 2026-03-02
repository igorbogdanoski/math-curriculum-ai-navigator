import { Document, Paragraph, TextRun, HeadingLevel, Packer, AlignmentType, Table, TableRow, TableCell, BorderStyle, WidthType } from 'docx';
import { saveAs } from 'file-saver';
import { LessonPlan, TeachingProfile } from '../types';

export const exportLessonPlanToWord = async (plan: LessonPlan, profile?: TeachingProfile | null) => {
    
    // Helper to add spacing
    const spacing = { after: 200 };

    // Helper for creating section headers
    const createHeader = (text: string) => {
        return new Paragraph({
            text: text,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
        });
    };

    // Helper for bullet lists
    const createBulletList = (items: Array<any>) => {
        if (!items || items.length === 0) return [new Paragraph({ text: "Нема", spacing })];
        
        return items.map(item => {
            const textContent = typeof item === 'string' ? item : item.text;
            const extra = item.bloomsLevel ? ` [${item.bloomsLevel}]` : '';
            return new Paragraph({
                text: `${textContent}${extra}`,
                bullet: { level: 0 },
                spacing: { after: 100 }
            });
        });
    };

    const doc = new Document({
        creator: profile?.name || "Math Curriculum AI Navigator",
        title: plan.title,
        styles: {
            default: {
                document: {
                    run: {
                        font: "Times New Roman",
                        size: 24, // 12pt
                    }
                }
            }
        },
        sections: [{
            properties: {
                page: {
                    margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } // 1 inch
                }
            },
            children: [
                // 1. Official Header (School & Teacher Info)
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 400 },
                    children: [
                        new TextRun({ text: profile?.schoolName || "ОУ „_________________“", bold: true, size: 28 }),
                        new TextRun({ text: profile?.municipality ? ` - ${profile.municipality}` : "", bold: true, size: 28 }),
                        new TextRun({ text: "\nДНЕВНА ПОДГОТОВКА ЗА НАСТАВЕН ЧАС", bold: true, size: 28, break: 1 }),
                    ]
                }),

                // 2. Meta Info Table
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    borders: {
                        top: { style: BorderStyle.NONE },
                        bottom: { style: BorderStyle.NONE },
                        left: { style: BorderStyle.NONE },
                        right: { style: BorderStyle.NONE },
                        insideHorizontal: { style: BorderStyle.NONE },
                        insideVertical: { style: BorderStyle.NONE },
                    },
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph({ text: "Наставник:", bold: true })] }),
                                new TableCell({ children: [new Paragraph(profile?.name || "_________________")] }),
                                new TableCell({ children: [new Paragraph({ text: "Предмет:", bold: true })] }),
                                new TableCell({ children: [new Paragraph(plan.subject || "Математика")] }),
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph({ text: "Одделение:", bold: true })] }),
                                new TableCell({ children: [new Paragraph(`${plan.grade}. одделение`)] }),
                                new TableCell({ children: [new Paragraph({ text: "Дата:", bold: true })] }),
                                new TableCell({ children: [new Paragraph("___ . ___ . 202_  год.")] }),
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph({ text: "Тема:", bold: true })] }),
                                new TableCell({ columnSpan: 3, children: [new Paragraph(plan.theme || "")] }),
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph({ text: "Наставна единица:", bold: true })] }),
                                new TableCell({ columnSpan: 3, children: [new Paragraph(plan.title || "")] }),
                            ]
                        }),
                    ]
                }),

                new Paragraph({ text: "", spacing: { after: 200 } }), // add space

                // 3. Objectives
                createHeader("Наставни цели (Очекувани резултати)"),
                ...createBulletList(plan.objectives),

                // 4. Assessment
                createHeader("Стандарди за оценување"),
                ...createBulletList(plan.assessmentStandards),

                // 5. Materials
                createHeader("Средства и материјали"),
                ...createBulletList(plan.materials),

                // 6. Scenario
                createHeader("Сценарио за часот"),
                
                new Paragraph({ text: "Воведна активност:", bold: true, spacing: { before: 200, after: 100 } }),
                new Paragraph({ text: typeof plan.scenario?.introductory === 'string' ? plan.scenario.introductory : plan.scenario?.introductory?.text || "", spacing }),
                
                new Paragraph({ text: "Главни активности:", bold: true, spacing: { before: 200, after: 100 } }),
                ...createBulletList(plan.scenario?.main || []),

                new Paragraph({ text: "Завршна активност:", bold: true, spacing: { before: 200, after: 100 } }),
                new Paragraph({ text: typeof plan.scenario?.concluding === 'string' ? plan.scenario.concluding : plan.scenario?.concluding?.text || "", spacing }),

                // 7. Monitoring
                createHeader("Следење на напредокот"),
                ...createBulletList(plan.progressMonitoring),

                // 8. Differentiation (if any)
                ...(plan.differentiation ? [
                    createHeader("Диференцијација"),
                    new Paragraph({ text: plan.differentiation, spacing: { after: 200 } })
                ] : []),

                // 9. Reflection (if any)
                ...(plan.reflectionPrompt ? [
                    createHeader("Рефлексија"),
                    new Paragraph({ text: plan.reflectionPrompt, spacing: { after: 200 } })
                ] : []),
            ]
        }]
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${(plan.title || 'podgotovka').replace(/[^a-z0-9а-шѓѕјљњќџч]/gi, '_').toLowerCase()}.docx`);
};
