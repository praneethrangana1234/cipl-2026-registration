
import { Component,NgZone ,ChangeDetectorRef} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
  participated: boolean;
  teamMember: boolean;
  id?: string;
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


  constructor(private firestore: Firestore,private ngZone: NgZone,private cdr: ChangeDetectorRef) {}

  login() {
    if (
      this.username === 'cipl2026' &&
      this.password === '2026cipl'
    ) {
      this.loggedIn = true;
      this.error = '';
       this.loadCounts();
    } else {
      this.error = 'Invalid username or password.';
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
    nic: String(data['nic'] ?? ''),
    participated: data['participated'] === true,
    teamMember: data['teamMember'] === true
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
