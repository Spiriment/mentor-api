
import 'reflect-metadata';
import { AppDataSource } from './src/config/data-source';
import { MonthlySummaryService } from './src/services/monthlySummary.service';
import { User } from './src/database/entities/user.entity';

async function repro() {
  try {
    await AppDataSource.initialize();
    console.log('✅ Data Source initialized');

    const userRepo = AppDataSource.getRepository(User);
    const user = await userRepo.findOne({ where: {} });

    if (!user) {
      console.error('❌ No user found in database');
      return;
    }

    console.log(`📊 Testing report for user: ${user.id} (${user.email})`);

    const service = new MonthlySummaryService();
    const summary = await service.generateMonthlySummary(user.id, 2026, 2);
    
    console.log('✅ Report generated successfully:', summary);
  } catch (err) {
    console.error('❌ REPRO FAILED:', err);
    if (err instanceof Error) {
        console.error('Message:', err.message);
        console.error('Stack:', err.stack);
    }
  } finally {
    await AppDataSource.destroy();
  }
}

repro();
