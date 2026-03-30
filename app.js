// app.js - GoldCalc Pro with YouTube-style bottom tabs
(function () {
  // Helper to safely get element
  const $ = id => document.getElementById(id);

  // Small script loader for Chart.js
  function loadScript(url) {
    return new Promise((resolve, reject) => {
      if ([...document.scripts].some(s => s.src && s.src.indexOf(url) !== -1)) return resolve();
      const s = document.createElement('script');
      s.src = url;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load ' + url));
      document.head.appendChild(s);
    });
  }

  class GoldCalcPro {
    constructor() {
      this.invoices = [];
      this.customers = [];
      this.settings = {
        shopName: 'Gold Jewelers',
        address: 'Main Bazaar Road',
        phone: '+92 300 1234567',
        taxId: 'NTN-XXXXXX',
        defaultKarat: 22,
        defaultRate: 150000,
        makingChargeRate: 10,
        autoSave: true
      };
      this.currentTab = 'dashboard';
      this.init();
    }

    init() {
      this.loadData();
      this.bindEvents();
      this.renderDashboard();
      this.generateInvoiceNumber();
      this.setCurrentDateTime();
      this.updateBottomTabBadge();
      
      // Mobile sidebar setup
      this.setupMobileSidebar();
      
      // Bottom tabs setup
      this.setupBottomTabs();
    }

    bindEvents() {
      // Desktop Tab Navigation
      document.querySelectorAll('.sidebar .nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
          e.preventDefault();
          this.switchTab(item.dataset.tab);
        });
      });

      // Mobile Sidebar Navigation
      document.querySelectorAll('.mobile-sidebar .nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
          e.preventDefault();
          this.switchTab(item.dataset.tab);
          this.closeMobileSidebar();
        });
      });

      // Calculator Events
      if ($('calculate-btn')) $('calculate-btn').addEventListener('click', () => this.calculate());
      if ($('save-invoice')) $('save-invoice').addEventListener('click', () => this.saveInvoice());
      if ($('clear-form')) $('clear-form').addEventListener('click', () => this.clearForm());
      if ($('print-preview')) $('print-preview').addEventListener('click', () => this.printInvoice());
      if ($('download-pdf')) $('download-pdf').addEventListener('click', () => this.downloadPDF());
      if ($('new-invoice')) {
        $('new-invoice').addEventListener('click', (e) => {
          e.preventDefault();
          this.switchTab('calculator');
        });
      }
      if ($('quick-calc')) {
        $('quick-calc').addEventListener('click', (e) => {
          e.preventDefault();
          this.switchTab('calculator');
        });
      }
      if ($('add-new-customer')) $('add-new-customer').addEventListener('click', () => this.addNewCustomer());

      // Weight Inputs Auto-calculate
      ['masa', 'ratti', 'tola'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => this.updateTotalWeight());
      });

      // Quick Actions
      document.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', (e) => this.handleQuickAction(e.currentTarget.dataset.action));
      });

      // Settings
      if ($('save-settings')) $('save-settings').addEventListener('click', () => this.saveSettings());
      if ($('backup-data')) $('backup-data').addEventListener('click', () => this.backupData());
      if ($('clear-data')) $('clear-data').addEventListener('click', () => this.clearAllData());

      // Reports
      if ($('generate-report')) $('generate-report').addEventListener('click', () => this.generateReport());

      // Modal
      const closeModalBtn = document.querySelector('.close-modal');
      if (closeModalBtn) closeModalBtn.addEventListener('click', () => this.hideModal());
      if ($('select-customer')) $('select-customer').addEventListener('click', () => this.showCustomerModal());

      // Data Import
      const restoreEl = $('restore-data');
      if (restoreEl) {
        restoreEl.addEventListener('change', e => {
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = ev => {
            try {
              const data = JSON.parse(ev.target.result);
              if (data.invoices) {
                this.invoices = data.invoices;
                this.customers = data.customers || this.customers;
                this.settings = data.settings || this.settings;
                this.saveData();
                this.renderDashboard();
                this.renderInvoices();
                this.updateBottomTabBadge();
                this.showToast('Data restored successfully', 'success');
              } else {
                this.showToast('Invalid backup file', 'error');
              }
            } catch (err) {
              this.showToast('Failed to parse JSON', 'error');
              console.error(err);
            }
          };
          reader.readAsText(file);
          e.target.value = '';
        });
      }

      // Handle window resize
      window.addEventListener('resize', () => this.handleResponsiveLayout());
    }

    setupMobileSidebar() {
      const openMobileSidebar = $('open-mobile-sidebar');
      const closeMobileSidebar = $('close-mobile-sidebar');
      const mobileSidebar = $('mobile-sidebar');
      const mobileSidebarOverlay = $('mobile-sidebar-overlay');

      if (openMobileSidebar) {
        openMobileSidebar.addEventListener('click', () => {
          mobileSidebar.classList.add('active');
          mobileSidebarOverlay.classList.add('active');
          document.body.style.overflow = 'hidden';
        });
      }

      if (closeMobileSidebar) {
        closeMobileSidebar.addEventListener('click', () => this.closeMobileSidebar());
      }

      if (mobileSidebarOverlay) {
        mobileSidebarOverlay.addEventListener('click', () => this.closeMobileSidebar());
      }
    }

    setupBottomTabs() {
      const bottomTabs = $('bottom-tabs');
      if (bottomTabs) {
        bottomTabs.addEventListener('click', (e) => {
          const tab = e.target.closest('.bottom-tab');
          if (tab) {
            e.preventDefault();
            this.switchTab(tab.dataset.tab);
          }
        });
      }
      
      // Add swipe functionality for mobile
      this.setupSwipeGestures();
    }

    setupSwipeGestures() {
      let touchStartX = 0;
      const tabContent = document.querySelector('.tab-content');
      const bottomTabNames = ['dashboard', 'calculator', 'invoices', 'reports', 'settings'];

      if (!tabContent) return;

      tabContent.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
      }, { passive: true });

      tabContent.addEventListener('touchend', (e) => {
        if (window.innerWidth > 768) return;

        const touchEndX = e.changedTouches[0].clientX;
        const diff = touchStartX - touchEndX;
        const swipeThreshold = 50;

        if (Math.abs(diff) <= swipeThreshold) return;
        const currentIndex = bottomTabNames.indexOf(this.currentTab);
        if (currentIndex === -1) return;

        if (diff > 0 && currentIndex < bottomTabNames.length - 1) {
          this.switchTab(bottomTabNames[currentIndex + 1]);
        } else if (diff < 0 && currentIndex > 0) {
          this.switchTab(bottomTabNames[currentIndex - 1]);
        }
      }, { passive: true });
    }

    switchTab(tabName) {
      this.currentTab = tabName;

      // Update all navigation
      this.updateNavigation(tabName);

      // Update page title
      const titles = {
        dashboard: 'Dashboard',
        calculator: 'Gold Calculator',
        invoices: 'Invoices',
        customers: 'Customers',
        inventory: 'Inventory',
        reports: 'Reports',
        settings: 'Settings'
      };

      if ($('page-title')) $('page-title').textContent = titles[tabName] || 'GoldCalc Pro';
      if ($('page-subtitle')) $('page-subtitle').textContent = this.getTabSubtitle(tabName);

      // Show/hide tab content
      document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.toggle('active', pane.id === tabName);
      });

      // Load tab-specific data
      switch (tabName) {
        case 'invoices':
          this.renderInvoices();
          break;
        case 'reports':
          this.renderReport();
          break;
        case 'customers':
          this.renderCustomers();
          break;
      }
    }

    updateNavigation(tabName) {
      // Update desktop sidebar
      document.querySelectorAll('.sidebar .nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.tab === tabName);
      });

      // Update mobile sidebar
      document.querySelectorAll('.mobile-sidebar .nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.tab === tabName);
      });

      // Update bottom tabs
      document.querySelectorAll('.bottom-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
      });
    }

    closeMobileSidebar() {
      const mobileSidebar = $('mobile-sidebar');
      const mobileSidebarOverlay = $('mobile-sidebar-overlay');
      
      if (mobileSidebar) mobileSidebar.classList.remove('active');
      if (mobileSidebarOverlay) mobileSidebarOverlay.classList.remove('active');
      document.body.style.overflow = '';
    }

    handleResponsiveLayout() {
      const isMobile = window.innerWidth <= 768;
      
      // Update mobile menu toggle visibility
      const mobileToggle = $('open-mobile-sidebar');
      if (mobileToggle) {
        mobileToggle.style.display = isMobile ? 'flex' : 'none';
      }
      
      // Update bottom tabs visibility
      const bottomTabs = $('bottom-tabs');
      if (bottomTabs) {
        bottomTabs.style.display = isMobile ? 'flex' : 'none';
      }
      
      // Update desktop sidebar visibility
      const desktopSidebar = document.querySelector('.sidebar.desktop-only');
      if (desktopSidebar) {
        desktopSidebar.style.display = isMobile ? 'none' : 'flex';
      }
      
      // Update main content margin
      const mainContent = document.querySelector('.main-content');
      if (mainContent) {
        mainContent.style.marginLeft = isMobile ? '0' : '260px';
        mainContent.style.paddingBottom = isMobile ? '70px' : '30px';
      }
    }

    // ... REST OF THE METHODS (calculate, saveInvoice, renderDashboard, etc.) ...
    // Keep all your existing methods from the original code here
    // Just replace the switchTab method and add the new methods above
    
    // Add this method to update bottom tab badge
    updateBottomTabBadge() {
      const badge = $('bottom-invoice-count');
      if (badge) {
        const count = this.invoices.length;
        badge.textContent = count;
        if (count > 0) {
          badge.style.display = 'flex';
        } else {
          badge.style.display = 'none';
        }
      }
    }

    // Update renderDashboard to also update bottom tab badge
    renderDashboard() {
      const totalInvoices = this.invoices.length;
      const totalGold = this.invoices.reduce((sum, inv) => sum + (inv.weight || 0), 0);
      const totalRevenue = this.invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
      const totalCustomers = new Set(this.invoices.map(inv => inv.customer)).size;

      if ($('total-invoices')) $('total-invoices').textContent = totalInvoices;
      if ($('total-gold')) $('total-gold').textContent = totalGold.toFixed(2) + ' g';
      if ($('total-revenue')) $('total-revenue').textContent =
        'PKR ' + totalRevenue.toLocaleString('en-PK', { minimumFractionDigits: 2 });
      if ($('total-customers')) $('total-customers').textContent = totalCustomers;

      // Update badges in all locations
      if ($('invoice-count')) $('invoice-count').textContent = totalInvoices;
      if ($('mobile-invoice-count')) $('mobile-invoice-count').textContent = totalInvoices;
      
      // Update bottom tab badge
      this.updateBottomTabBadge();

      this.updateRecentActivity();
    }

    // Keep all other methods exactly as they were in your original code
    // ... (calculate, saveInvoice, renderInvoices, etc.) ...

    getTabSubtitle(tabName) {
      const subtitles = {
        dashboard: 'Overview of your jewelry business',
        calculator: 'Calculate gold prices with precision',
        invoices: 'Manage and track all invoices',
        customers: 'Customer database and history',
        inventory: 'Stock management',
        reports: 'Analytics and insights',
        settings: 'Configure your shop settings'
      };
      return subtitles[tabName] || '';
    }

    calculate() {
      // Your existing calculate method
      const masa = parseFloat($('masa') ? $('masa').value : 0) || 0;
      const ratti = parseFloat($('ratti') ? $('ratti').value : 0) || 0;
      const tola = parseFloat($('tola') ? $('tola').value : 0) || 0;
      const karat = parseInt($('karat') ? $('karat').value : this.settings.defaultKarat) || 22;
      const rate = parseFloat($('gold-rate') ? $('gold-rate').value : this.settings.defaultRate) || 0;
      const rateUnit = $('rate-unit') ? $('rate-unit').value : 'gram';
      const makingCharges = parseFloat($('making-charges') ? $('making-charges').value : 0) || 0;

      const MASA_GRAM = 0.975;
      const RATTI_GRAM = 0.1215;
      const TOLA_GRAM = 11.6638038;

      const totalGrams = (masa * MASA_GRAM) + (ratti * RATTI_GRAM) + (tola * TOLA_GRAM);
      let ratePerGram = rate;
      if (rateUnit === 'tola' || rateUnit === 'pertola') {
        ratePerGram = rate / TOLA_GRAM;
      }

      const purity = karat / 24;
      const goldValue = totalGrams * ratePerGram * purity;
      const total = goldValue + makingCharges;

      this.updatePreview(totalGrams, goldValue, makingCharges, total, { karat, rate, rateUnit });

      return {
        weight: totalGrams,
        goldValue,
        makingCharges,
        total,
        karat,
        rate,
        rateUnit
      };
    }

    updatePreview(weight, goldValue, makingCharges, total, meta = {}) {
      // Your existing updatePreview method
      const tolaWeight = weight / 11.6638038;
      if ($('preview-weight')) {
        $('preview-weight').textContent =
          `${weight.toFixed(3)} g (${tolaWeight.toFixed(4)} Tola)`;
      }

      if ($('preview-gold-value')) {
        $('preview-gold-value').textContent =
          `PKR ${goldValue.toLocaleString('en-PK', { minimumFractionDigits: 2 })}`;
      }

      if ($('preview-making-charges')) {
        $('preview-making-charges').textContent =
          `PKR ${makingCharges.toLocaleString('en-PK', { minimumFractionDigits: 2 })}`;
      }

      if ($('preview-total')) {
        $('preview-total').textContent =
          `PKR ${total.toLocaleString('en-PK', { minimumFractionDigits: 2 })}`;
      }

      if ($('preview-shop-name')) $('preview-shop-name').textContent =
        ($('shop-name') && $('shop-name').value) || this.settings.shopName;

      if ($('preview-shop-address')) $('preview-shop-address').textContent =
        ($('shop-address') && $('shop-address').value) || this.settings.address;

      if ($('preview-shop-phone')) $('preview-shop-phone').textContent =
        ($('shop-phone') && $('shop-phone').value) || this.settings.phone;

      if ($('preview-customer-name')) $('preview-customer-name').textContent =
        ($('customer-name') && $('customer-name').value) || 'Walk-in Customer';

      if ($('preview-invoice-no') && $('invoice-no')) $('preview-invoice-no').textContent = $('invoice-no').value || '';

      const dateInput = $('invoice-date') ? $('invoice-date').value : null;
      const date = dateInput || new Date().toISOString().slice(0, 16);
      if ($('preview-date')) {
        try {
          $('preview-date').textContent = new Date(date).toLocaleString();
        } catch (e) {
          $('preview-date').textContent = date;
        }
      }
    }

    saveInvoice() {
      const calculation = this.calculate();

      if (calculation.weight <= 0 || calculation.rate <= 0) {
        this.showToast('Please enter valid weight and rate', 'error');
        return;
      }

      const invoice = {
        id: this.generateId(),
        invoiceNo: $('invoice-no') ? $('invoice-no').value : this.generateId(),
        date: $('invoice-date') ? $('invoice-date').value : new Date().toISOString(),
        customer: $('customer-name') ? $('customer-name').value : 'Walk-in Customer',
        shopName: $('shop-name') ? $('shop-name').value : this.settings.shopName,
        weight: calculation.weight,
        karat: calculation.karat,
        rate: calculation.rate,
        rateUnit: calculation.rateUnit,
        goldValue: calculation.goldValue,
        makingCharges: calculation.makingCharges,
        total: calculation.total,
        notes: $('customer-notes') ? $('customer-notes').value : '',
        status: 'paid'
      };

      this.invoices.push(invoice);
      this.saveData();
      this.renderDashboard();
      this.renderInvoices();

      this.showToast('Invoice saved successfully!', 'success');
      this.generateInvoiceNumber();
    }

    generateInvoiceNumber() {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');

      const invoiceNo = `INV-${year}${month}${day}-${random}`;
      if ($('invoice-no')) $('invoice-no').value = invoiceNo;
      return invoiceNo;
    }

    setCurrentDateTime() {
      const now = new Date();
      const localDateTime = now.toISOString().slice(0, 16);
      if ($('invoice-date')) $('invoice-date').value = localDateTime;
    }

    clearForm() {
      if (confirm('Clear all form data?')) {
        if ($('customer-name')) $('customer-name').value = '';
        if ($('customer-notes')) $('customer-notes').value = '';
        if ($('masa')) $('masa').value = '';
        if ($('ratti')) $('ratti').value = '';
        if ($('tola')) $('tola').value = '';
        if ($('gold-rate')) $('gold-rate').value = '';
        if ($('making-charges')) $('making-charges').value = '';

        this.generateInvoiceNumber();
        this.setCurrentDateTime();

        this.updatePreview(0, 0, 0, 0);
      }
    }

    updateRecentActivity() {
      const container = $('recent-activity');
      if (!container) return;
      const recent = this.invoices.slice(-5).reverse();

      container.innerHTML = recent.map(invoice => `
            <div class="activity-item">
                <i class="fas fa-file-invoice activity-icon"></i>
                <div class="activity-content">
                    <p>New invoice ${invoice.invoiceNo} for ${invoice.customer}</p>
                    <small>${new Date(invoice.date).toLocaleDateString()}</small>
                </div>
            </div>
        `).join('') || '<div class="text-center p-4">No recent activity</div>';
    }

    renderInvoices() {
      const container = $('invoices-table');
      if (!container) return;

      if (this.invoices.length === 0) {
        container.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center p-4">
                        <i class="fas fa-inbox fa-2x mb-2" style="color: #cbd5e1;"></i>
                        <p>No invoices found</p>
                    </td>
                </tr>
            `;
        return;
      }

      container.innerHTML = this.invoices.map(invoice => `
           <tr class="border-b hover:bg-gray-50 transition">
    <td class="px-4 py-3 font-semibold text-gray-800">
        ${invoice.invoiceNo}
    </td>

    <td class="px-4 py-3 text-gray-600">
        ${invoice.customer}
    </td>

    <td class="px-4 py-3 text-gray-500">
        ${new Date(invoice.date).toLocaleDateString()}
    </td>

    <td class="px-4 py-3 text-gray-600">
        ${(invoice.weight || 0).toFixed(3)} g
    </td>

    <td class="px-4 py-3 font-medium text-gray-800">
        PKR ${(invoice.total || 0).toLocaleString('en-PK', {minimumFractionDigits: 2})}
    </td>

    <td class="px-4 py-3">
        <span class="
            px-3 py-1 text-xs font-semibold rounded-full capitalize
            ${invoice.status === 'paid' ? 'bg-green-100 text-green-700' : ''}
            ${invoice.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : ''}
            ${invoice.status === 'unpaid' ? 'bg-red-100 text-red-700' : ''}
        ">
            ${invoice.status}
        </span>
    </td>

    <td class="px-4 py-3">
        <div class="flex items-center gap-2">
            <button 
                class="view-btn p-2 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 transition"
                data-id="${invoice.id}" 
                title="View"
            >
                <i class="fas fa-eye"></i>
            </button>

            <button 
                class="print-btn p-2 rounded-md bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition"
                data-id="${invoice.id}" 
                title="Print"
            >
                <i class="fas fa-print"></i>
            </button>

            <button 
                class="delete-btn p-2 rounded-md bg-red-50 text-red-600 hover:bg-red-100 transition"
                data-id="${invoice.id}" 
                title="Delete"
            >
                <i class="fas fa-trash"></i>
            </button>
        </div>
    </td>
</tr>
        `).join('');

      container.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', (e) => this.viewInvoice(e.currentTarget.dataset.id));
      });
      container.querySelectorAll('.print-btn').forEach(btn => {
        btn.addEventListener('click', (e) => this.printInvoiceById(e.currentTarget.dataset.id));
      });
      container.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => this.deleteInvoice(e.currentTarget.dataset.id));
      });
    }

    viewInvoice(invoiceId) {
      const invoice = this.invoices.find(inv => inv.id === invoiceId);
      if (invoice) {
        if ($('customer-name')) $('customer-name').value = invoice.customer;
        if ($('invoice-no')) $('invoice-no').value = invoice.invoiceNo;
        if ($('masa')) $('masa').value = '';
        if ($('ratti')) $('ratti').value = '';
        if ($('tola')) $('tola').value = '';

        this.switchTab('calculator');
        this.updatePreview(invoice.weight, invoice.goldValue, invoice.makingCharges, invoice.total);
        this.showToast('Invoice loaded', 'info');
      }
    }

    deleteInvoice(invoiceId) {
      if (confirm('Are you sure you want to delete this invoice?')) {
        this.invoices = this.invoices.filter(inv => inv.id !== invoiceId);
        this.saveData();
        this.renderDashboard();
        this.renderInvoices();
        this.showToast('Invoice deleted', 'success');
      }
    }

    renderReport() {
      const startDateEl = $('report-start-date');
      const endDateEl = $('report-end-date');
      const startDate = startDateEl ? startDateEl.value : null;
      const endDate = endDateEl ? endDateEl.value : null;

      let filteredInvoices = this.invoices;

      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filteredInvoices = this.invoices.filter(inv => {
          const invDate = new Date(inv.date);
          return invDate >= start && invDate <= end;
        });
      }

      const totalSales = filteredInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
      const goldSold = filteredInvoices.reduce((sum, inv) => sum + (inv.weight || 0), 0);
      const avgInvoice = totalSales / (filteredInvoices.length || 1);

      if ($('report-total-sales')) $('report-total-sales').textContent =
        `PKR ${totalSales.toLocaleString('en-PK', { minimumFractionDigits: 2 })}`;
      if ($('report-gold-sold')) $('report-gold-sold').textContent = `${goldSold.toFixed(2)} g`;
      if ($('report-total-invoices')) $('report-total-invoices').textContent = filteredInvoices.length;
      if ($('report-avg-invoice')) $('report-avg-invoice').textContent =
        `PKR ${avgInvoice.toLocaleString('en-PK', { minimumFractionDigits: 2 })}`;

      this.updateSalesChart(filteredInvoices);
    }

    async updateSalesChart(invoices) {
      const canvas = $('sales-chart');
      if (!canvas) return;
      
      const salesByDate = {};
      invoices.forEach(invoice => {
        const date = new Date(invoice.date).toLocaleDateString();
        salesByDate[date] = (salesByDate[date] || 0) + (invoice.total || 0);
      });

      const dates = Object.keys(salesByDate).sort();
      const amounts = dates.map(date => salesByDate[date]);

      if (typeof Chart === 'undefined') {
        try {
          await loadScript('https://cdn.jsdelivr.net/npm/chart.js');
        } catch (err) {
          console.warn('Chart.js failed to load', err);
          return;
        }
      }

      if (window.salesChart) {
        try { window.salesChart.destroy(); } catch (e) { }
      }

      window.salesChart = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
          labels: dates,
          datasets: [{
            label: 'Daily Sales (PKR)',
            data: amounts,
            borderColor: 'rgb(37, 99, 235)',
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            tension: 0.4,
            fill: true
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: function (value) {
                  if (Number.isFinite(value)) return 'PKR ' + value.toLocaleString();
                  return value;
                }
              }
            }
          }
        }
      });
    }

    generateReport() {
      this.renderReport();
      this.showToast('Report generated successfully', 'success');
    }

    async downloadPDF() {
      try {
        const element = $('invoice-preview');
        if (!element) return this.showToast('No invoice to export', 'error');

        await this.generatePDFfromElement(element, `invoice-${$('invoice-no') ? $('invoice-no').value : 'invoice'}.pdf`);
        this.showToast('PDF downloaded successfully', 'success');
      } catch (error) {
        console.error('PDF generation error:', error);
        this.showToast('Error generating PDF', 'error');
      }
    }

    printInvoice() {
      const el = $('invoice-preview');
      if (!el) return this.showToast('Nothing to print', 'error');

      const win = window.open('', '_blank', 'width=900,height=700');
      if (!win) return this.showToast('Popup blocked. Allow popups for printing.', 'error');

      const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
        .map(node => node.outerHTML).join('\n');

      win.document.open();
      win.document.write(`
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8"/>
            <title>Print Invoice</title>
            ${styles}
            <style>
              body { margin: 18px; color: #111; font-family: Arial, Helvetica, sans-serif; }
              .invoice-preview { max-width: 800px; margin: 0 auto; }
            </style>
          </head>
          <body>
            <div class="invoice-preview">${el.innerHTML}</div>
            <script>
              window.onload = function() { setTimeout(() => { window.print(); }, 200); };
            </script>
          </body>
        </html>
      `);
      win.document.close();
    }

    printInvoiceById(invoiceId) {
      const invoice = this.invoices.find(inv => inv.id === invoiceId);
      if (invoice) {
        this.viewInvoice(invoiceId);
        setTimeout(() => this.printInvoice(), 300);
      }
    }

    async generatePDFfromElement(element, filename = 'document.pdf') {
      if (typeof html2canvas === 'undefined') {
        try {
          await loadScript('https://html2canvas.hertzen.com/dist/html2canvas.min.js');
        } catch (e) {
          this.showToast('html2canvas not available', 'error');
          throw e;
        }
      }
      
      if (typeof window.jspdf === 'undefined') {
        try {
          await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
        } catch (e) {
          this.showToast('jsPDF not available', 'error');
          throw e;
        }
      }

      const originalBg = element.style.background;
      element.style.background = '#ffffff';
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      element.style.background = originalBg;

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const jsPDFLib = window.jspdf && (window.jspdf.jsPDF || window.jspdf.default) ? (window.jspdf.jsPDF || window.jspdf.default) : (window.jspdf ? window.jspdf : null);
      const jsPDFCtor = (jsPDFLib && typeof jsPDFLib === 'function') ? jsPDFLib : (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : null;
      const jsPDFClass = jsPDFCtor || (window.jspdf && window.jspdf.jsPDF) || null;
      
      if (!jsPDFClass) {
        this.showToast('jsPDF constructor not found', 'error');
        throw new Error('jsPDF not found');
      }

      const pdf = new jsPDFClass('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const imgProps = pdf.getImageProperties(imgData);
      const imgWidthMM = pdfWidth - 10;
      const imgHeightMM = (imgProps.height * imgWidthMM) / imgProps.width;
      pdf.addImage(imgData, 'JPEG', 5, 5, imgWidthMM, imgHeightMM);
      pdf.save(filename);
    }

    saveSettings() {
      this.settings = {
        shopName: $('setting-shop-name') ? $('setting-shop-name').value : this.settings.shopName,
        address: $('setting-address') ? $('setting-address').value : this.settings.address,
        phone: $('setting-phone') ? $('setting-phone').value : this.settings.phone,
        taxId: $('setting-tax') ? $('setting-tax').value : this.settings.taxId,
        defaultKarat: parseInt($('default-karat') ? $('default-karat').value : this.settings.defaultKarat),
        defaultRate: parseFloat($('default-rate') ? $('default-rate').value : this.settings.defaultRate),
        makingChargeRate: parseFloat($('making-charge-rate') ? $('making-charge-rate').value : this.settings.makingChargeRate),
        autoSave: $('auto-save-invoices') ? $('auto-save-invoices').checked : this.settings.autoSave
      };

      this.saveData();
      this.showToast('Settings saved successfully', 'success');
    }

    backupData() {
      const data = {
        invoices: this.invoices,
        settings: this.settings,
        customers: this.customers,
        backupDate: new Date().toISOString()
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');

      a.href = url;
      a.download = `goldcalc-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.showToast('Backup created successfully', 'success');
    }

    clearAllData() {
      if (confirm('This will delete ALL data including invoices, customers, and settings. Continue?')) {
        this.invoices = [];
        this.customers = [];
        this.settings = {
          shopName: 'Gold Jewelers',
          address: 'Main Bazaar Road',
          phone: '+92 300 1234567',
          taxId: 'NTN-XXXXXX',
          defaultKarat: 22,
          defaultRate: 150000,
          makingChargeRate: 10,
          autoSave: true
        };

        this.saveData();
        this.renderDashboard();
        this.renderInvoices();
        this.updateBottomTabBadge();
        this.showToast('All data cleared', 'success');
      }
    }

    showCustomerModal() {
      const modal = $('customer-modal');
      if (!modal) return;
      modal.classList.add('active');
      this.renderCustomerList();
    }

    hideModal() {
      const modal = $('customer-modal');
      if (!modal) return;
      modal.classList.remove('active');
    }

    renderCustomerList() {
      const container = $('customer-list');
      if (!container) return;

      if (this.customers.length === 0) {
        container.innerHTML = `
                <div class="text-center p-4">
                    <p>No customers saved</p>
                    <button class="btn btn-primary mt-2" id="add-new-customer-button">
                        <i class="fas fa-user-plus"></i> Add New Customer
                    </button>
                </div>
            `;
        const btn = $('add-new-customer-button');
        if (btn) btn.addEventListener('click', () => this.addNewCustomer());
        return;
      }

      container.innerHTML = this.customers.map(customer => `
            <div class="customer-item" data-id="${customer.id}">
                <div>
                    <strong>${customer.name}</strong>
                    <p class="small">${customer.phone || 'No phone'}</p>
                </div>
                <i class="fas fa-chevron-right"></i>
            </div>
        `).join('');

      container.querySelectorAll('.customer-item').forEach(el => {
        const id = el.dataset.id;
        el.addEventListener('click', () => this.selectCustomer(id));
      });
    }

    selectCustomer(customerId) {
      const customer = this.customers.find(c => c.id === customerId);
      if (customer) {
        if ($('customer-name')) $('customer-name').value = customer.name;
        this.hideModal();
        this.showToast(`Customer ${customer.name} selected`, 'info');
      }
    }

    addNewCustomer() {
      const name = prompt('Enter customer name');
      if (!name) return this.showToast('Customer name is required', 'error');
      const phone = prompt('Enter phone (optional)') || '';
      const customer = {
        id: this.generateId(),
        name,
        phone
      };
      this.customers.push(customer);
      this.saveData();
      this.renderCustomerList();
      this.showToast(`Customer ${name} added`, 'success');
    }

    generateId() {
      return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    showToast(message, type = 'info') {
      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      toast.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;

      document.body.appendChild(toast);
      setTimeout(() => toast.classList.add('show'), 10);
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }

    saveData() {
      try {
        const data = {
          invoices: this.invoices,
          settings: this.settings,
          customers: this.customers
        };
        localStorage.setItem('goldcalc-pro-data', JSON.stringify(data));
      } catch (e) {
        console.error('Unable to save data:', e);
      }
    }

    loadData() {
      const saved = localStorage.getItem('goldcalc-pro-data');
      if (saved) {
        try {
          const data = JSON.parse(saved);
          this.invoices = data.invoices || [];
          this.settings = data.settings || this.settings;
          this.customers = data.customers || [];

          if ($('setting-shop-name')) $('setting-shop-name').value = this.settings.shopName;
          if ($('setting-address')) $('setting-address').value = this.settings.address;
          if ($('setting-phone')) $('setting-phone').value = this.settings.phone;
          if ($('setting-tax')) $('setting-tax').value = this.settings.taxId;
          if ($('default-karat')) $('default-karat').value = this.settings.defaultKarat;
          if ($('default-rate')) $('default-rate').value = this.settings.defaultRate;
          if ($('making-charge-rate')) $('making-charge-rate').value = this.settings.makingChargeRate;
          if ($('auto-save-invoices')) $('auto-save-invoices').checked = !!this.settings.autoSave;

          if ($('shop-name')) $('shop-name').value = this.settings.shopName;
          if ($('shop-address')) $('shop-address').value = this.settings.address;
          if ($('shop-phone')) $('shop-phone').value = this.settings.phone;
          if ($('shop-tax')) $('shop-tax').value = this.settings.taxId;
          if ($('karat')) $('karat').value = this.settings.defaultKarat;
          if ($('gold-rate')) $('gold-rate').value = this.settings.defaultRate;

        } catch (e) {
          console.error('Error loading saved data:', e);
        }
      }
    }

    updateTotalWeight() {
      // kept for future real-time weight integration
    }

    handleQuickAction(action) {
      switch (action) {
        case 'create-invoice':
          this.switchTab('calculator');
          break;
        case 'add-customer':
          this.showCustomerModal();
          break;
        case 'check-rates':
          this.showToast('Gold rates feature coming soon!', 'info');
          break;
        case 'print-receipt':
          this.printInvoice();
          break;
        default:
          this.showToast('Unknown action: ' + action, 'info');
      }
    }

    renderCustomers() {
      const container = $('customers-table');
      if (!container) return;
      
      if (this.customers.length === 0) {
        container.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center p-4">
                        <i class="fas fa-users fa-2x mb-2" style="color: #cbd5e1;"></i>
                        <p>No customers found</p>
                    </td>
                </tr>
            `;
        return;
      }
      
      // Implementation for customers table
      container.innerHTML = this.customers.map(customer => `
            <tr>
                <td>${customer.name}</td>
                <td>${customer.phone || 'N/A'}</td>
                <td>${customer.email || 'N/A'}</td>
                <td>PKR 0.00</td>
                <td>Never</td>
                <td>
                    <button class="btn-icon" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }
  }

  // Initialize the application
  let app;
  document.addEventListener('DOMContentLoaded', () => {
    app = new GoldCalcPro();
    
    // Initial responsive layout setup
    app.handleResponsiveLayout();

    // Insert toast styles
    if (!document.getElementById('goldcalc-toast-styles')) {
      const style = document.createElement('style');
      style.id = 'goldcalc-toast-styles';
      style.textContent = `
        .toast { position: fixed; top: 20px; right: 20px; background: white; padding: 12px 18px; border-radius: 10px; box-shadow: 0 10px 25px rgba(0,0,0,0.08); display:flex; gap:10px; align-items:center; transform: translateX(120%); transition: transform .25s; z-index:10000; border-left: 4px solid #0ea5e9; }
        .toast.show { transform: translateX(0); }
        .toast-success { border-left-color: #16a34a; }
        .toast-error { border-left-color: #ef4444; }
        .toast-info { border-left-color: #0ea5e9; }
        .toast i { font-size: 18px; }
      `;
      document.head.appendChild(style);
    }
    
    // Close modal when clicking outside
    document.addEventListener('click', (e) => {
      const modal = document.getElementById('customer-modal');
      if (modal && modal.classList.contains('active') && 
          !modal.contains(e.target) && 
          !e.target.closest('#select-customer')) {
        modal.classList.remove('active');
      }
    });
  });
})();
