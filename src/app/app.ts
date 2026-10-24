
import { Component,NgZone ,ChangeDetectorRef} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { writeBatch } from '@angular/fire/firestore';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import {
  Firestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc
} from '@angular/fire/firestore';

interface Member {
  epf: string;
  nic: string;
  fname: string;
  participated: boolean;
  teamMember: boolean;
   registered: boolean;
  id?: string;
}
interface ImportMember {
  epf: string;
  fname: string;
  nic: string;
  participated: boolean;
  teamMember: boolean;
  registered: boolean;
}



@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  username = '';
  password = '';
  loggedIn = false;

  searchEpf = '';
  member: Member | null = null;
  participated = false;

  loading = false;
  saving = false;
  message = '';
  error = '';

allCount = 0;
participatedCount = 0;
notParticipatedCount = 0;
countsLoading = false;
showImportForm = false;
csvFileName = '';
importRows: ImportMember[] = [];
importLoading = false;
importMessage = '';
importError = '';

  constructor(private firestore: Firestore,private ngZone: NgZone,private cdr: ChangeDetectorRef) {}

  async login() {
  this.error = '';
  this.message = '';

  const username = this.username.trim();
  const password = this.password;

  if (!username || !password) {
    this.error = 'Enter username and password.';
    return;
  }

  try {
    const usersRef = collection(this.firestore, 'userlogin');

    const userQuery = query(
      usersRef,
      where('username', '==', username),
      where('password', '==', password),
      where('active', '==', true)
    );

    const result = await getDocs(userQuery);

    if (result.empty) {
      this.error = 'Invalid username or password.';
      return;
    }

    this.loggedIn = true;
    this.password = '';
    this.error = '';

    await this.loadCounts();

  } catch (e) {
    console.error('Login error:', e);
    this.error = 'Login failed. Check Firebase permissions.';
  } finally {
    this.cdr.detectChanges();
  }
}

async loadCounts() {
  this.countsLoading = true;

  try {
    const membersRef = collection(this.firestore, 'members');
    const result = await getDocs(membersRef);

    let all = 0;
    let participated = 0;
    let notParticipated = 0;

    result.forEach((memberDoc) => {
      const data = memberDoc.data();

      all++;

      if (data['participated'] === true) {
        participated++;
      } else if (data['participated'] === false) {
        notParticipated++;
      }
    });

    this.allCount = all;
    this.participatedCount = participated;
    this.notParticipatedCount = notParticipated;

    console.log('ALL:', all);
    console.log('PARTICIPATED:', participated);
    console.log('NOT PARTICIPATED:', notParticipated);

  } catch (e) {
    console.error('Failed to load participation counts:', e);
    this.error = 'Could not load participation counts.';
  } finally {
    this.countsLoading = false;
    this.cdr.detectChanges();
  }
}



  async loadMember() {
  console.log('1. Load button clicked');

  this.member = null;
  this.message = '';
  this.error = '';

  const epf = this.searchEpf.trim();

  if (!epf) {
    this.error = 'Please enter an EPF number.';
    return;
  }

  this.loading = true;
  console.log('2. Loading set to true');

  try {
    console.log('3. Creating Firestore query');

    const membersRef = collection(this.firestore, 'members');
    const memberQuery = query(
      membersRef,
      where('epf', '==', epf)
    );

    console.log('4. Sending Firestore request');

    const result = await getDocs(memberQuery);

    console.log('5. Firestore response received');
    console.log('Documents found:', result.size);

    if (result.empty) {
      this.error = 'Employee not found.';
      return;
    }

    if (result.size > 1) {
      this.error = 'Duplicate EPF records found.';
      return;
    }

    const memberDoc = result.docs[0];
    const data = memberDoc.data();

   this.ngZone.run(() => {
  this.member = {
    id: memberDoc.id,
    epf: String(data['epf'] ?? ''),
    fname: String(data['fname'] ?? ''),
    nic: String(data['nic'] ?? ''),
    participated: data['participated'] === true,
    teamMember: data['teamMember'] === true,
    registered: data['registered'] === true,
  };

  this.participated = this.member.participated;
  this.cdr.detectChanges();
  this.message = 'Employee details loaded successfully.';
});
    console.log('6. Employee data assigned:', this.member);

  } catch (e) {
    console.error('FIRESTORE ERROR:', e);
    this.error = 'Failed to load employee. Check Console.';
  } finally {
  this.loading = false;
  this.cdr.detectChanges();

  console.log('Loading finished');
}
}
  async updateParticipation() {
    if (!this.member?.id) {
      this.error = 'Please load an employee first.';
      return;
    }

    this.saving = true;
    this.error = '';
    this.message = '';

    try {
      const memberRef = doc(
        this.firestore,
        'members',
        this.member.id
      );

      await updateDoc(memberRef, {
        participated: this.participated
      });

      this.member.participated = this.participated;
      this.message = 'Participation status updated successfully.';
      await this.loadCounts();
    } catch (e) {
      console.error(e);
      this.error = 'Update failed. Check Firebase permissions.';
    } finally {
      this.saving = false;
      
    this.cdr.detectChanges();

    console.log('3. Update loading finished');
    }
  }
//////////////////////////
 openImportForm() {
  this.showImportForm = !this.showImportForm;
  this.importError = '';
  this.importMessage = '';
}

onCsvSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  this.importRows = [];
  this.csvFileName = '';
  this.importError = '';
  this.importMessage = '';

  if (!file) return;

  if (!file.name.toLowerCase().endsWith('.csv')) {
    this.importError = 'Please select a CSV file.';
    input.value = '';
    return;
  }

  this.csvFileName = file.name;

  Papa.parse<Record<string, string>>(file, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) =>
      header.replace(/^\uFEFF/, '').trim().toLowerCase(),

    complete: (result) => {
      this.ngZone.run(() => {
        const headers = result.meta.fields ?? [];

        if (
          !headers.includes('epf') ||
          !headers.includes('nic') ||
          (!headers.includes('name') && !headers.includes('fname'))
        ) {
          this.importError =
            'CSV headers must contain epf, name, nic.';
          this.cdr.detectChanges();
          return;
        }

        const seen = new Set<string>();

        for (const row of result.data) {
          const epf = String(row['epf'] ?? '').trim();
          const fname = String(
            row['fname'] ?? row['name'] ?? ''
          ).trim();
          const nic = String(row['nic'] ?? '').trim();

          if (!epf && !fname && !nic) continue;

          if (!epf || !fname || !nic) {
            this.importError =
              'Some rows have missing EPF, Name or NIC. Please correct the CSV.';
            this.importRows = [];
            this.cdr.detectChanges();
            return;
          }

          if (seen.has(epf)) {
            this.importError =
              `Duplicate EPF ${epf} found in CSV. Please correct the file.`;
            this.importRows = [];
            this.cdr.detectChanges();
            return;
          }

          seen.add(epf);

          this.importRows.push({
            epf,
            fname,
            nic,
            participated: false,
            teamMember: false,
            registered: true
          });
        }

        if (result.errors.length > 0) {
          this.importRows = [];
          this.importError = 'Could not read the CSV correctly.';
        } else if (this.importRows.length === 0) {
          this.importError = 'No employee records found in CSV.';
        } else {
          this.importMessage =
            `${this.importRows.length} employee records loaded. Please review before saving.`;
        }

        this.cdr.detectChanges();
      });
    },

    error: (error) => {
      this.ngZone.run(() => {
        this.importError = `CSV read failed: ${error.message}`;
        this.cdr.detectChanges();
      });
    }
  });
}

async saveImportToFirebase() {
  if (!this.loggedIn) {
    this.importError = 'Please log in before saving employee records.';
    return;
  }

  if (this.importRows.length === 0 || this.importLoading) return;

  this.importLoading = true;
  this.importError = '';
  this.importMessage = '';

  try {
    const membersRef = collection(this.firestore, 'members');

    // Read existing EPF numbers to prevent duplicate records.
    const existing = await getDocs(membersRef);
    const existingEpfs = new Set(
      existing.docs.map(d => String(d.data()['epf'] ?? '').trim())
    );

    const duplicates = this.importRows.filter(
      row => existingEpfs.has(row.epf)
    );

    const newRows = this.importRows.filter(
      row => !existingEpfs.has(row.epf)
    );

    let saved = 0;

    // Keep batches below Firestore's 500-write limit.
    for (let i = 0; i < newRows.length; i += 450) {
      const batch = writeBatch(this.firestore);

      for (const row of newRows.slice(i, i + 450)) {
        const newDoc = doc(membersRef);
        batch.set(newDoc, {
          epf: row.epf,
          fname: row.fname,
          nic: row.nic,
          participated: false,
          teamMember: false,
          registered: true
        });
      }

      await batch.commit();
      saved += Math.min(450, newRows.length - i);
    }

    this.importMessage =
      `Import complete. Saved: ${saved}. Existing EPF records skipped: ${duplicates.length}.`;

    this.importRows = [];
    this.csvFileName = '';
    await this.loadCounts();

  } catch (e) {
    console.error('CSV IMPORT ERROR:', e);
    this.importError =
      'Import failed. Check Firebase permissions and Console.';
  } finally {
    this.importLoading = false;
    this.cdr.detectChanges();
  }
}
 

async exportExcel() {
  this.error = '';
  this.message = '';

  try {
    const membersRef = collection(this.firestore, 'members');
    const snapshot = await getDocs(membersRef);

    if (snapshot.empty) {
      this.error = 'No employee records found in Firebase.';
      return;
    }

    const employees = snapshot.docs.map((memberDoc) => {
      const data = memberDoc.data();

      return {
        epf: String(data['epf'] ?? ''),
        name: String(data['fname'] ?? data['name'] ?? ''),
        teamMember: data['teamMember'] === true,
        participated: data['participated'] === true
      };
    });

    // Participated employees first; non-participated employees last.
    employees.sort((a, b) => {
      if (a.participated !== b.participated) {
        return Number(b.participated) - Number(a.participated);
      }

      return a.name.localeCompare(b.name);
    });

    const excelData = employees.map((employee) => ({
      'EPF': employee.epf,
      'Name': employee.name,
      'Team Member': employee.teamMember ? 'Yes' : 'No',
      'Participated': employee.participated ? 'Yes' : 'No'
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    worksheet['!cols'] = [
      { wch: 18 },
      { wch: 30 },
      { wch: 18 },
      { wch: 18 }
    ];

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      'CIPL 2026'
    );

    XLSX.writeFile(
      workbook,
      'CIPL_2026_Employee_Participation.xlsx'
    );

    this.message =
      `Excel exported successfully. Total employees: ${employees.length}.`;

  } catch (e) {
    console.error('Excel export error:', e);
    this.error =
      'Excel export failed. Check Firebase permissions and Console.';
  } finally {
    this.cdr.detectChanges();
  }
}
 
 
 
 
 
 ////////////////////////////
  logout() {
    this.loggedIn = false;
    this.username = '';
    this.password = '';
    this.searchEpf = '';
    this.member = null;
    this.message = '';
    this.error = '';
  }
}
