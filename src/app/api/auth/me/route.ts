import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { isSystemAdmin } from '@/lib/admin';
import { getSessionUser } from '@/lib/session';
import { readStudents } from '@/lib/student-store';

type UserRecord = {
  id: string;
  name: string;
  nickname?: string;
  email?: string;
  password: string;
};

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }
    const fileName = user.role === 'teacher' ? 'teachers.json' : 'students.json';
    const filePath = path.resolve(process.cwd(), 'data', fileName);

    if (user.role === 'student' || fs.existsSync(filePath)) {
      const users =
        user.role === 'student'
          ? ((await readStudents()) as UserRecord[])
          : (JSON.parse(fs.readFileSync(filePath, 'utf-8')) as UserRecord[]);
      const latestUser = users.find((item) => item.id === user.id);
      if (latestUser) {
        user.name = user.role === 'student' ? latestUser.nickname || user.name || latestUser.id : latestUser.name;
        if (user.role === 'student') {
          return NextResponse.json({ user: { ...user, email: latestUser.email ?? "" } });
        }
      }
    }

    return NextResponse.json({ user: { ...user, isSystemAdmin: isSystemAdmin(user) } });
  } catch {
    return NextResponse.json({ user: null }, { status: 401 });
  }
}
