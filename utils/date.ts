export const getWeekRange = (date: Date): { start: Date; end: Date } => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const start = new Date(d.setDate(diff));
    
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    
    return { start, end };
};

export const getDaysInWeek = (date: Date): Date[] => {
    const { start } = getWeekRange(date);
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
        const nextDay = new Date(start);
        nextDay.setDate(start.getDate() + i);
        days.push(nextDay);
    }
    return days;
};