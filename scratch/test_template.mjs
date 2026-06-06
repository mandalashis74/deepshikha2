const canEdit = true;
const item = {
  flat_no: '3A',
  occupancy_status: 'owner-occupied',
  owner_name: '[{"name":"Banashree Mishra"}]',
  contact_no: '',
  family_members: '',
  service_person: '',
  vehicle_details: ''
};

function renderStructuredRows(prefix, value, canEdit) {
    return `[Structured Rows for ${prefix}]`;
}

const html = `
    ${canEdit ? '<button type="button" class="btn btn-slate btn-add-structured-row" onclick="addStructuredRow(\'contact\')" style="margin-top: 6px; font-size:0.8rem; padding:4px 12px; display:none;"><i class="fa-solid fa-plus"></i> Add Contact</button>' : ''}
`;

console.log("Resulting HTML:\n", html.trim());
